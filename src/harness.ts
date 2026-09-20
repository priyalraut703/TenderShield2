import { WebSocket } from 'ws';
import { readFileSync } from 'node:fs';
import pino, { type Logger } from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  type EnvironmentConfiguration,
  waitForFunds,
} from '@midnight-ntwrk/testkit-js';

import { getConfig } from './config.js';
import {
  MidnightWalletProvider,
  syncWallet,
  type WalletSecret,
} from './wallet.js';
import { buildProviders, type TenderShieldProviders } from './providers.js';
import { zkConfigPath } from '../contracts/index.js';

// Required for GraphQL subscriptions in Node.js
// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;

export const ALICE_LOCAL_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';

export function createLogger(): Logger {
  return pino({
    level: process.env['LOG_LEVEL'] ?? 'info',
    transport: { target: 'pino-pretty' },
  });
}

// Lightweight .env.<network> loader so tools can rely on env files without a
// dotenv dependency. Shell-set variables always win.
function loadDotEnv(net: string): void {
  try {
    const content = readFileSync(`.env.${net}`, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env.<network> file present; rely on the shell environment.
  }
}

export function resolveSecret(net: string): WalletSecret {
  if (net === 'local') return { kind: 'seed', value: ALICE_LOCAL_SEED };

  loadDotEnv(net);
  const upper = net.toUpperCase();
  const mnemonicEnv = `MIDNIGHT_${upper}_MNEMONIC`;
  const seedEnv = `MIDNIGHT_${upper}_SEED`;
  const mnemonic = process.env[mnemonicEnv]?.trim().replace(/\s+/g, ' ');
  const seedHex = process.env[seedEnv]?.trim();

  if (mnemonic && seedHex) {
    throw new Error(
      `Set only one of ${mnemonicEnv} or ${seedEnv} (both are defined).`,
    );
  }
  if (mnemonic) {
    return { kind: 'mnemonic', value: mnemonic };
  }
  if (seedHex) {
    if (!/^[0-9a-fA-F]+$/.test(seedHex) || seedHex.length % 2 !== 0) {
      throw new Error(
        `${seedEnv} must be a hex string of even length (no 0x prefix).`,
      );
    }
    return { kind: 'seed', value: seedHex };
  }
  throw new Error(
    `Either ${mnemonicEnv} or ${seedEnv} is required for network '${net}'. ` +
      `Set one in .env.${net} or the shell.`,
  );
}

export type TestHarness = {
  wallet: MidnightWalletProvider;
  providers: TenderShieldProviders;
};

export async function startHarness(
  network: string,
  logger: Logger,
): Promise<TestHarness> {
  const config = getConfig();
  const secret = resolveSecret(network);
  const isRemote = network !== 'local';
  const syncTimeoutMs = isRemote ? 60 * 60_000 : 10 * 60_000;

  setNetworkId(config.networkId);

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

  const wallet = await MidnightWalletProvider.build(logger, envConfig, secret);
  await wallet.start();
  await syncWallet(logger, wallet.wallet, syncTimeoutMs);

  if (isRemote) {
    // NIGHT→DUST registration. Seed is pre-funded via the faucet page; idempotent.
    const nightBalance = await waitForFunds(
      wallet.wallet,
      envConfig,
      false,
      wallet.unshieldedKeystore,
    );
    logger.info(`Wallet NIGHT balance on '${network}': ${nightBalance}`);
  }

  const providers = buildProviders(wallet, zkConfigPath, config);
  logger.info(`Providers initialized on '${network}'. Ready to test!`);
  return { wallet, providers };
}

export function toBytes32(text: string): Uint8Array {
  const out = new Uint8Array(32);
  const encoded = new TextEncoder().encode(text);
  out.set(encoded.slice(0, 32));
  return out;
}

export function bigintToBytes32(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = BigInt(value);
  for (let i = 31; i >= 0 && v > 0n; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomBytes32(): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}