import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { deployContract, type DeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';

import { getConfig } from '../src/config.js';
import { buildProviders, type TenderShieldProviders } from '../src/providers.js';
import { type MidnightWalletProvider } from '../src/wallet.js';
import { createLogger, startHarness, toBytes32 } from '../src/harness.js';
import { CompiledTenderShieldContract, type TenderShieldContract } from '../contracts/index.js';

const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';

const TENDER_ID = toBytes32('TS-DEPLOY-0001');
const MIN_TURNOVER = 5_000_000n;
const PRIVATE_STATE_ID = 'TenderShieldDeployState';

describe(`TenderShield deployment (${network})`, () => {
  let wallet: MidnightWalletProvider;
  let providers: TenderShieldProviders;

  const config = getConfig();
  const logger = createLogger();

  beforeAll(async () => {
    ({ wallet, providers } = await startHarness(network, logger));
  });

  afterAll(async () => {
    if (wallet) {
      logger.info('Stopping wallet...');
      await wallet.stop();
    }
  });

  it('deploys the TenderShield contract and prints the address', async () => {
    const deployed: DeployedContract<TenderShieldContract> =
      await (deployContract<TenderShieldContract>)(providers, {
        compiledContract: CompiledTenderShieldContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
        args: [TENDER_ID, MIN_TURNOVER],
      });

    const contractAddress: ContractAddress =
      deployed.deployTxData.public.contractAddress;

    console.log('');
    console.log('====================================================');
    console.log('TenderShield Contract Address:');
    console.log(contractAddress);
    console.log(`Network: ${network}`);
    console.log('====================================================');
    console.log('');

    expect(contractAddress).toBeDefined();
    expect(contractAddress.length).toBeGreaterThan(0);
  });
});