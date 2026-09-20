// Connectivity + wallet sync diagnostic for the local devnet.
import { WebSocket } from 'ws';
import { inspect } from 'node:util';
import pino from 'pino';
// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';

const logger = pino({ level: 'silent' });

function rpcCall(url: string, method: string, params: unknown[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { abort('timeout'); }, 8000);
    const abort = (what: string) => { try { ws.terminate(); } catch {}; reject(new Error(`${method} ${what}`)); };
    ws.on('open', () => ws.send(JSON.stringify({ id: 1, jsonrpc: '2.0', method, params })));
    ws.on('message', (data) => { clearTimeout(timer); resolve(String(data)); ws.close(); });
    ws.on('error', (e) => { clearTimeout(timer); reject(new Error(`${method} ws error: ${e.message}`)); });
  });
}

async function probeGraphql(url: string): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          '{ chainStats { headerHeight finalizedHeight } connectionStatus { indexerStatus } }',
      }),
    });
    console.log(`indexer ${url}:`, res.status, await res.text());
  } catch (e) {
    console.log(`indexer ${url}: ERROR ${(e as Error).message}`);
  }
}

async function main() {
  await probeGraphql('http://127.0.0.1:8088/api/v4/graphql');
  console.log('node system_health:', await rpcCall('ws://127.0.0.1:9944', 'system_health'));
  console.log('node state_runtimeVersion:', await rpcCall('ws://127.0.0.1:9944', 'state_getRuntimeVersion'));
  console.log('node tenderShield_checkRuntimeVersion:', await rpcCall('ws://127.0.0.1:9944', 'state_subscribeRuntimeVersion'));

  setNetworkId('undeployed');
  const wallet = await FluentWalletBuilder.forEnvironment({
    walletNetworkId: 'undeployed',
    networkId: 'undeployed',
    indexer: 'http://127.0.0.1:8088/api/v4/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    node: 'http://127.0.0.1:9944',
    nodeWS: 'ws://127.0.0.1:9944',
    faucet: '',
    proofServer: 'http://127.0.0.1:6300',
  }).withSeed('0000000000000000000000000000000000000000000000000000000000000001').build();

  const state = wallet.state();
  state.subscribe({
    next: (s: any) => {
      const p = (x: any) =>
        inspect(x && typeof x === 'object' ? x.progress ?? x : x, { depth: 4, breakLength: Infinity });
      console.log('STATE:', inspect(s, { depth: 2, breakLength: 200 }));
    },
    error: (e: any) => {
      console.log('STATE ERROR (full):');
      console.log(inspect(e, { depth: 8, breakLength: Infinity, colors: false }));
    },
  });

  console.log('starting wallet...');
  (wallet as any).start?.();
  await new Promise((r) => setTimeout(r, 20000));
  console.log('done diagnostic window');
  process.exit(0);
}

main().catch((e) => {
  console.log('FATAL:', inspect(e, { depth: 8 }));
  process.exit(1);
});