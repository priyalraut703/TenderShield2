// Prints the wallet address(es) for a given network, useful to know where to
// send faucet funds. Usage: npx vite-node scripts/show-address.ts  (defaults
// to 'preview'; override with MIDNIGHT_NETWORK).
import { WebSocket } from 'ws';
// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;

import pino from 'pino';
import {
  type EnvironmentConfiguration,
  FluentWalletBuilder,
} from '@midnight-ntwrk/testkit-js';

import { getConfig } from '../src/config.js';
import { resolveSecret } from '../src/harness.js';

const network = process.env['MIDNIGHT_NETWORK'] ?? 'preview';
const config = getConfig();
const logger = pino({ level: 'warn' });

const envConfig: EnvironmentConfiguration = {
  walletNetworkId: config.networkId,
  networkId: config.networkId,
  indexer: config.indexer,
  indexerWS: config.indexerWS,
  node: config.node,
  nodeWS: config.nodeWS,
  faucet: config.faucet,
  proofServer: config.proofServer,
};

const secret = resolveSecret(network);
const base = FluentWalletBuilder.forEnvironment(envConfig);
const builder =
  secret.kind === 'mnemonic' ? base.withMnemonic(secret.value) : base.withSeed(secret.value);

const { wallet, seeds } = (await builder.buildWithoutStarting()) as {
  wallet: any;
  seeds: { masterSeed: string; shielded: Uint8Array; dust: Uint8Array };
};

console.log(`Network:               ${network}`);
console.log(`Seed kind:             ${secret.kind}`);
console.log(`Master seed prefix:    ${seeds.masterSeed.slice(0, 8)}...`);

// Probe the wallet facade for the address getters. Different wallet-sdk
// versions expose slightly different names, so try the common ones.
for (const method of ['getAddress', 'getUnshieldedAddress', 'getUserAddress']) {
  if (typeof wallet[method] === 'function') {
    try {
      const value = await wallet[method]();
      console.log(`${method}():              ${value}`);
    } catch (err) {
      console.log(`${method}():              ERROR ${(err as Error).message}`);
    }
  }
}

try {
  await wallet.start(undefined as unknown as any, undefined as unknown as any);
  const state = await wallet.state?.().pipe
    ? undefined
    : undefined;
  console.log('wallet.state():          (available after start)');
  for (const method of ['getAddress', 'getUnshieldedAddress', 'getUserAddress']) {
    if (typeof wallet[method] === 'function') {
      try {
        const value = await wallet[method]();
        console.log(`${method}() after start:      ${value}`);
      } catch (err) {
        console.log(`${method}() after start:      ERROR ${(err as Error).message}`);
      }
    }
  }
  await wallet.stop();
} catch (err) {
  console.log(`wallet.start/stop:        ${(err as Error).message}`);
}

console.log('');
console.log(
  'Fund the printed unshielded address at the Preview faucet:',
  config.faucet,
);
console.log('(Addresses printed once walletsupport startup worked are authoritative.)');