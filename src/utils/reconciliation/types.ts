import { L1GlobalState } from "../l1/types";
import { L2SupplyData } from "../l2/types";

export interface ReconciledGlobalState {
  totalSupply: number;
  lockedSupply: number;
  lockedSupplyGenesis: number;
  liquidSupply: number;
  circulatingSupply: number;
  // Breakdown for transparency
  l1Breakdown: L1GlobalState;
  l2Breakdown: L2SupplyData;
  reconciliationTimestamp: number;
}

export interface ReconciliationResult {
  success: boolean;
  reconciledSupply?: ReconciledGlobalState;
  errors: string[];
  l1FetchDurationMs: number;
  l2FetchDurationMs: number;
  totalDurationMs: number;
}

export interface ReconciliationConfig {
  l2SubgraphUrl: string;
  enableValidation: boolean;
  toleranceThreshold: number; // For cross-validation checks
}