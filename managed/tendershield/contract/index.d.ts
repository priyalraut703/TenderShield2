import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum TenderStatus { OPEN = 0, CLOSED = 1, AWARDED = 2 }

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  submitEligibleBid(context: __compactRuntime.CircuitContext<PS>,
                    vendorId_0: Uint8Array,
                    annualTurnover_0: bigint,
                    opening_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeTender(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  submitEligibleBid(context: __compactRuntime.CircuitContext<PS>,
                    vendorId_0: Uint8Array,
                    annualTurnover_0: bigint,
                    opening_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeTender(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  submitEligibleBid(context: __compactRuntime.CircuitContext<PS>,
                    vendorId_0: Uint8Array,
                    annualTurnover_0: bigint,
                    opening_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeTender(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly tenderId: Uint8Array;
  readonly status: TenderStatus;
  readonly minTurnover: bigint;
  readonly turnoverCommitment: Uint8Array;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               id_0: Uint8Array,
               threshold_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
