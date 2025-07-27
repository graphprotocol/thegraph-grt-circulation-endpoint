import { L1GlobalState } from "../l1/types";
import { L2SupplyData } from "../l2/types";

/**
 * Reconciled global state representing the unified view of GRT token supply across L1 and L2.
 * 
 * This interface represents the final calculated values after reconciling L1 (Ethereum) and L2 (Arbitrum)
 * supply data. All numeric values are in human-readable decimal format (not wei) and represent the
 * true global state of The Graph token ecosystem.
 * 
 * Mathematical relationships that must hold:
 * - totalSupply = liquidSupply + lockedSupply
 * - circulatingSupply ≤ totalSupply
 * - circulatingSupply ≤ liquidSupply
 */
export interface ReconciledGlobalState {
  /** 
   * Total GRT tokens across both L1 and L2 = L1 totalSupply + L2 netSupply.
   * This avoids double-counting tokens bridged from L1 to L2.
   */
  totalSupply: number;
  
  /** 
   * GRT tokens locked in staking contracts (currently only on L1).
   * Future L2 staking would require updating the reconciliation logic.
   */
  lockedSupply: number;
  
  /** 
   * Historical genesis locked supply baseline from L1 protocol launch.
   * Used for rewards calculations and protocol parameters.
   */
  lockedSupplyGenesis: number;
  
  /** 
   * Total liquid (unlocked) tokens = totalSupply - lockedSupply.
   * Represents all tokens not locked in staking contracts.
   */
  liquidSupply: number;
  
  /** 
   * Actively circulating tokens = L1 circulatingSupply + L2 netSupply.
   * Represents tokens actively used in the ecosystem (may be less than liquid).
   * Uses L2 net supply for mathematical consistency with total supply calculation.
   */
  circulatingSupply: number;
  
  /** Original L1 data preserved for transparency and debugging */
  l1Breakdown: L1GlobalState;
  
  /** Original L2 data preserved for transparency and debugging */
  l2Breakdown: L2SupplyData;
  
  /** Unix timestamp when this reconciliation was performed */
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