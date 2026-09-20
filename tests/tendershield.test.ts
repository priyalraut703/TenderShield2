import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  deployContract,
  submitCallTx,
  type DeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import pino from 'pino';

import { getConfig } from '../src/config.js';
import { buildProviders, type TenderShieldProviders } from '../src/providers.js';
import { type MidnightWalletProvider } from '../src/wallet.js';
import {
  createLogger,
  startHarness,
  toBytes32,
  bigintToBytes32,
  randomBytes32,
} from '../src/harness.js';
import {
  CompiledTenderShieldContract,
  type TenderShieldContract,
  ledger,
} from '../contracts/index.js';
import { zkConfigPath } from '../contracts/index.js';

const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';

// Public tender parameters (identical to what goes into the constructor)
const TENDER_ID = toBytes32('TS-2026-001');
const MIN_TURNOVER = 5_000_000n;

// Vendor credentials kept strictly private from the ledger
const VENDOR_ID = toBytes32('vendor-registration-0x9f2c');
const ELIGIBLE_TURNOVER = 6_000_000n;
const INELIGIBLE_TURNOVER = 4_500_000n;

const PRIVATE_STATE_ID = 'TenderShieldPrivateState';

const status = { OPEN: 0, CLOSED: 1, AWARDED: 2 } as const;
const emptyCommitment = () => new Uint8Array(32);

describe(`TenderShield Contract (${network})`, () => {
  let wallet: MidnightWalletProvider;
  let providers: TenderShieldProviders;
  let contractAddress: ContractAddress;

  const config = getConfig();
  const logger = createLogger();

  async function queryLedger(p: TenderShieldProviders) {
    const state = await p.publicDataProvider.queryContractState(contractAddress);
    expect(state).not.toBeNull();
    return ledger(state!.data);
  }

  async function deployFreshTender() {
    const deployed: DeployedContract<TenderShieldContract> =
      await (deployContract<TenderShieldContract>)(providers, {
        compiledContract: CompiledTenderShieldContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
        args: [TENDER_ID, MIN_TURNOVER],
      });
    contractAddress = deployed.deployTxData.public.contractAddress;
    return contractAddress;
  }

  async function submitEligibleBid(
    vendorId: Uint8Array,
    annualTurnover: bigint,
    opening: Uint8Array,
  ) {
    await (submitCallTx<TenderShieldContract, 'submitEligibleBid'>)(providers, {
      compiledContract: CompiledTenderShieldContract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'submitEligibleBid',
      args: [vendorId, annualTurnover, opening],
    });
  }

  async function closeTender() {
    await (submitCallTx<TenderShieldContract, 'closeTender'>)(providers, {
      compiledContract: CompiledTenderShieldContract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'closeTender',
      args: [],
    });
  }

  beforeAll(async () => {
    ({ wallet, providers } = await startHarness(network, logger));
  });

  afterAll(async () => {
    if (wallet) {
      logger.info('Stopping wallet...');
      await wallet.stop();
    }
  });

  it('deploys a tender and publishes only the public tender parameters', async () => {
    await deployFreshTender();
    const state = await queryLedger(providers);

    expect(state.tenderId).toEqual(TENDER_ID);
    expect(state.minTurnover).toEqual(MIN_TURNOVER);
    expect(state.status).toBe(status.OPEN);
    // No bid has been placed yet: the commitment is still empty.
    expect(state.turnoverCommitment).toEqual(emptyCommitment());
  });

  it('awards the tender to an eligible bid and records only a commitment', async () => {
    await deployFreshTender();
    await submitEligibleBid(VENDOR_ID, ELIGIBLE_TURNOVER, randomBytes32());

    const state = await queryLedger(providers);
    expect(state.status).toBe(status.AWARDED);
    // A commitment was recorded: it is no longer the empty default...
    expect(state.turnoverCommitment).not.toEqual(emptyCommitment());
    // ...and it must be a 32-byte value (a SHA-256 commitment digest).
    expect(state.turnoverCommitment.length).toBe(32);
  });

  it('rejects an ineligible bid and leaves the public state unchanged', async () => {
    await deployFreshTender();
    await expect(
      submitEligibleBid(VENDOR_ID, INELIGIBLE_TURNOVER, randomBytes32()),
    ).rejects.toThrow();

    const state = await queryLedger(providers);
    expect(state.status).toBe(status.OPEN);
    expect(state.turnoverCommitment).toEqual(emptyCommitment());
  });

  it('keeps the vendor’s sensitive values out of the public ledger', async () => {
    await deployFreshTender();

    const vendorId = toBytes32('vendor-privacy-check-0x7c1e');
    const annualTurnover = 7_500_000n;
    const opening = randomBytes32();

    await submitEligibleBid(vendorId, annualTurnover, opening);

    const state = await queryLedger(providers);

    // The commitment must NOT be the raw turnover, the vendor id, or the opening.
    expect(Array.from(state.turnoverCommitment)).not.toEqual(
      Array.from(bigintToBytes32(annualTurnover)),
    );
    expect(Array.from(state.turnoverCommitment)).not.toEqual(
      Array.from(vendorId),
    );
    expect(Array.from(state.turnoverCommitment)).not.toEqual(
      Array.from(opening),
    );
    // The raw turnover must not collide with any scalar public field either.
    expect(state.minTurnover).not.toEqual(annualTurnover);
    expect(state.tenderId).toEqual(TENDER_ID);
  });

  it('rejects bids once the tender is closed', async () => {
    await deployFreshTender();
    await closeTender();

    const closedState = await queryLedger(providers);
    expect(closedState.status).toBe(status.CLOSED);

    await expect(
      submitEligibleBid(VENDOR_ID, ELIGIBLE_TURNOVER, randomBytes32()),
    ).rejects.toThrow();

    const state = await queryLedger(providers);
    expect(state.status).toBe(status.CLOSED);
    expect(state.turnoverCommitment).toEqual(emptyCommitment());
  });
});