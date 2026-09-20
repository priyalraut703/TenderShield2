import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import type { Contract as JsContract } from '@midnight-ntwrk/compact-js/effect/Contract';
import type { Types } from 'effect';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Contract as GeneratedContract,
  ledger,
  type Ledger,
} from '../managed/tendershield/contract/index.js';

export { ledger };
export type { Ledger };

// The compiler-generated class (`contract/index.d.ts`) is written against the
// same `@midnight-ntwrk/compact-runtime` type surface that `compact-js`
// re-exports, so `JsContract` (below) is structurally aligned. The generated
// circuits wrap their results in a Promise whereas the `compact-js` runtime
// types are non-nullable/looser, so the class is surfaced through the
// `compact-js` `Contract` interface rather than its raw generated d.ts. The
// generated JavaScript and the installed runtime are both 0.16.0
// (`checkRuntimeVersion('0.16.0')` runs at import time of the generated code),
// so this is purely a TypeScript-level adaptation.
export type TenderShieldContract = JsContract<any>;

export const Contract: Types.Ctor<TenderShieldContract> =
  GeneratedContract as unknown as Types.Ctor<TenderShieldContract>;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(
  currentDir,
  '..',
  'managed',
  'tendershield',
);

export const CompiledTenderShieldContract = CompiledContract.make(
  'TenderShield',
  Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);