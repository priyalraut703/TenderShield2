import util from 'node:util';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import { getConfig } from '../src/config.js';
import { createLogger, startHarness, toBytes32 } from '../src/harness.js';
import {
  CompiledTenderShieldContract,
  type TenderShieldContract,
} from '../contracts/index.js';

async function main() {
  const config = getConfig();
  const logger = createLogger();
  setNetworkId(config.networkId);

  const { wallet, providers } = await startHarness('local', logger);
  try {
    const deployed = await deployContract<TenderShieldContract>(providers, {
      compiledContract: CompiledTenderShieldContract,
      privateStateId: 'debug-private-state',
      initialPrivateState: {},
      args: [toBytes32('TS-2026-001'), 5_000_000n],
    });
    logger.info(
      `deployed at ${deployed.deployTxData.public.contractAddress}`,
    );
  } catch (e) {
    console.error('DEPLOY FAILED');
    console.error(util.inspect(e, { depth: 12, colors: false }));
  } finally {
    await wallet.stop();
  }
}

void main();