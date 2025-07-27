import { L1GlobalState } from "../l1/types";
import { L2SupplyData } from "../l2/types"; 
import { getGlobalStateByBlockNumber, getLatestGlobalState } from "../l1/global-states.graphql";
import { getL2SupplyByBlockNumber, getLatestL2Supply } from "../l2/supply-data.graphql";
import { globalRetryHandler } from "./retry-handler";
import { validateL1Data, validateL2Data, validateReconciledData } from "./validation";
import { ReconciliationResult, ReconciledGlobalState, ReconciliationConfig } from "./types";
import { Decimal } from "decimal.js";

const DIVISION_NUMBER = "1000000000000000000"; // 10^18

export class SupplyReconciler {
  private config: ReconciliationConfig;

  constructor(config: ReconciliationConfig) {
    this.config = config;
  }

  async getReconciledLatestSupply(): Promise<ReconciliationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let l1FetchDurationMs = 0;
    let l2FetchDurationMs = 0;

    try {
      // Fetch L1 and L2 data in parallel with retry logic
      const [l1Result, l2Result] = await Promise.allSettled([
        this.fetchL1DataWithRetry(),
        this.fetchL2DataWithRetry(),
      ]);

      l1FetchDurationMs = l1Result.status === 'fulfilled' ? (l1Result as PromiseFulfilledResult<{ data: L1GlobalState; durationMs: number }>).value.durationMs : 0;
      l2FetchDurationMs = l2Result.status === 'fulfilled' ? (l2Result as PromiseFulfilledResult<{ data: L2SupplyData; durationMs: number }>).value.durationMs : 0;

      // Check if both L1 and L2 succeeded (deterministic requirement)
      if (l1Result.status === 'rejected') {
        errors.push(`L1 fetch failed: ${l1Result.reason}`);
      }

      if (l2Result.status === 'rejected') {
        errors.push(`L2 fetch failed: ${l2Result.reason}`);
      }

      if (errors.length > 0) {
        return {
          success: false,
          errors,
          l1FetchDurationMs,
          l2FetchDurationMs,
          totalDurationMs: Date.now() - startTime,
        };
      }

      const l1Data = (l1Result as PromiseFulfilledResult<{ data: L1GlobalState; durationMs: number }>).value.data;
      const l2Data = (l2Result as PromiseFulfilledResult<{ data: L2SupplyData; durationMs: number }>).value.data;

      // Validate data if enabled
      if (this.config.enableValidation) {
        const l1Validation = validateL1Data(l1Data);
        const l2Validation = validateL2Data(l2Data);

        if (!l1Validation.isValid) {
          errors.push(...l1Validation.errors.map(e => `L1 validation: ${e}`));
        }

        if (!l2Validation.isValid) {
          errors.push(...l2Validation.errors.map(e => `L2 validation: ${e}`));
        }

        if (errors.length > 0) {
          return {
            success: false,
            errors,
            l1FetchDurationMs,
            l2FetchDurationMs,
            totalDurationMs: Date.now() - startTime,
          };
        }

        // Log warnings
        [...l1Validation.warnings, ...l2Validation.warnings].forEach(warning => {
          console.warn(`Supply validation warning: ${warning}`);
        });
      }

      // Reconcile the data
      const reconciledSupply = this.reconcileSupplyData(l1Data, l2Data);

      // Final validation of reconciled data
      if (this.config.enableValidation) {
        const reconciledValidation = validateReconciledData(reconciledSupply, l1Data, l2Data);
        
        if (!reconciledValidation.isValid) {
          errors.push(...reconciledValidation.errors.map(e => `Reconciliation validation: ${e}`));
          
          return {
            success: false,
            errors,
            l1FetchDurationMs,
            l2FetchDurationMs,
            totalDurationMs: Date.now() - startTime,
          };
        }

        reconciledValidation.warnings.forEach(warning => {
          console.warn(`Reconciliation validation warning: ${warning}`);
        });
      }

      return {
        success: true,
        reconciledSupply,
        errors: [],
        l1FetchDurationMs,
        l2FetchDurationMs,
        totalDurationMs: Date.now() - startTime,
      };

    } catch (error) {
      errors.push(`Reconciliation error: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        success: false,
        errors,
        l1FetchDurationMs,
        l2FetchDurationMs,
        totalDurationMs: Date.now() - startTime,
      };
    }
  }

  async getReconciledSupplyByTimestamp(timestamp: number, etherscanApiKey: string): Promise<ReconciliationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let l1FetchDurationMs = 0;
    let l2FetchDurationMs = 0;

    try {
      // For timestamp-based queries, we need to get block numbers first
      const { getBlockByTimestamp, getLatestBlock } = await import("../blocks-info.graphql");
      
      const blockDetails = await getBlockByTimestamp(timestamp, etherscanApiKey).then(
        async (blockInfo) => {
          if (!blockInfo) return await getLatestBlock(etherscanApiKey);
          return blockInfo;
        }
      );

      // Fetch L1 and L2 data for specific block in parallel
      const [l1Result, l2Result] = await Promise.allSettled([
        this.fetchL1DataByBlockWithRetry(blockDetails),
        this.fetchL2DataByBlockWithRetry(blockDetails),
      ]);

      l1FetchDurationMs = l1Result.status === 'fulfilled' ? (l1Result as PromiseFulfilledResult<{ data: L1GlobalState; durationMs: number }>).value.durationMs : 0;
      l2FetchDurationMs = l2Result.status === 'fulfilled' ? (l2Result as PromiseFulfilledResult<{ data: L2SupplyData; durationMs: number }>).value.durationMs : 0;

      // Check if both L1 and L2 succeeded
      if (l1Result.status === 'rejected') {
        errors.push(`L1 fetch failed: ${l1Result.reason}`);
      }

      if (l2Result.status === 'rejected') {
        errors.push(`L2 fetch failed: ${l2Result.reason}`);
      }

      if (errors.length > 0) {
        return {
          success: false,
          errors,
          l1FetchDurationMs,
          l2FetchDurationMs,
          totalDurationMs: Date.now() - startTime,
        };
      }

      const l1Data = (l1Result as PromiseFulfilledResult<{ data: L1GlobalState; durationMs: number }>).value.data;
      const l2Data = (l2Result as PromiseFulfilledResult<{ data: L2SupplyData; durationMs: number }>).value.data;

      // Validate and reconcile (same logic as latest)
      if (this.config.enableValidation) {
        const l1Validation = validateL1Data(l1Data);
        const l2Validation = validateL2Data(l2Data);

        if (!l1Validation.isValid || !l2Validation.isValid) {
          errors.push(...l1Validation.errors, ...l2Validation.errors);
          return {
            success: false,
            errors,
            l1FetchDurationMs,
            l2FetchDurationMs,
            totalDurationMs: Date.now() - startTime,
          };
        }
      }

      const reconciledSupply = this.reconcileSupplyData(l1Data, l2Data);

      return {
        success: true,
        reconciledSupply,
        errors: [],
        l1FetchDurationMs,
        l2FetchDurationMs,
        totalDurationMs: Date.now() - startTime,
      };

    } catch (error) {
      errors.push(`Timestamp-based reconciliation error: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        success: false,
        errors,
        l1FetchDurationMs,
        l2FetchDurationMs,
        totalDurationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Reconciles L1 and L2 supply data into a unified view of The Graph's GRT token supply.
   * 
   * ## DATA SOURCES
   * 
   * ### L1 Data (Ethereum Mainnet)
   * - **Source**: The Graph GRT Supply Subgraph on Ethereum mainnet (grt-supply-subgraph)
   * - **Subgraph ID**: `6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY`
   * - **Query**: `getLatestGlobalState()` or `getGlobalStateByBlockNumber()`
   * - **Key Features**: Tracks GRT mint/burn events, vesting contract schedules, and token lock releases
   * - **Fields Retrieved**:
   *   - `totalSupply`: Total GRT tokens (minted - burned) including all inflation since genesis (in wei)
   *   - `lockedSupply`: GRT locked in staking contracts and vesting schedules on L1 (in wei)
   *   - `lockedSupplyGenesis`: Genesis locked supply baseline for reward calculations (in wei)
   *   - `liquidSupply`: GRT available for circulation on L1 (total - locked) (in wei)
   *   - `circulatingSupply`: GRT actively circulating on L1 (liquid - genesis locked) (in wei)
   * 
   * ### L2 Data (Arbitrum One)
   * - **Source**: The Graph Network Subgraph on Arbitrum One (graph-network-subgraph)
   * - **Subgraph ID**: `DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp`
   * - **Query**: `getLatestL2Supply()` or `getL2SupplyByBlockNumber()`
   * - **Key Features**: Tracks L2 network operations, bridge transactions, and token minting/burning
   * - **Fields Retrieved**:
   *   - `totalSupply`: Total GRT supply on L2 (bridged tokens + newly minted tokens) (in wei)
   *   - `totalGRTDepositedConfirmed`: Cumulative GRT bridged from L1 to L2 (confirmed deposits) (in wei)
   *   - `totalGRTWithdrawn`: Cumulative GRT withdrawn from L2 to L1 (initiated withdrawals) (in wei)
   *   - `netL2Supply`: New GRT minted on L2 = totalSupply - (deposited - withdrawn) (in wei)
   * 
   * ## DATA PROCESSING
   * 
   * ### Wei to Decimal Conversion
   * All token amounts are stored on-chain in wei (10^18 smallest units). We convert to 
   * human-readable decimal numbers by dividing by 10^18 for calculations and display.
   * This prevents floating point precision issues while maintaining readability.
   * 
   * ## RECONCILIATION LOGIC
   * 
   * ### 1. Total Supply Calculation
   * **Formula**: `Reconciled Total = L1 Total + L2 Net Supply`
   * 
   * **Why this works**:
   * - L1 totalSupply includes all tokens originally minted on L1
   * - When tokens bridge to L2, they remain in L1's total count (they don't disappear)
   * - L2 netSupply represents ONLY new tokens minted on L2, accounting for bridge flows
   * - Bridge flow accounting: L2 Net = L2 Total - (Deposits - Withdrawals)
   * - This avoids double-counting bridged tokens in both directions
   * 
   * **Example**:
   * - L1 Total: 10.8B GRT (includes tokens that bridged to L2)
   * - L2 Total: 3.34B GRT (deposited + newly minted)
   * - L2 Deposited: 3.23B GRT (cumulative L1→L2 transfers)
   * - L2 Withdrawn: 0.37B GRT (cumulative L2→L1 transfers)
   * - L2 Net: 3.34B - (3.23B - 0.37B) = 0.48B GRT (new tokens only)
   * - Combined: 10.8B + 0.48B = 11.28B GRT (correct total across both chains)
   * 
   * ### 2. Circulating Supply Calculation
   * **Formula**: `Reconciled Circulating = L1 Circulating + L2 Net Supply`
   * 
   * **Why this works**:
   * - L1 circulatingSupply represents tokens available for use on L1
   * - L2 netSupply represents new tokens available for use on L2 (accounting for bridge flows)
   * - We use L2 NET supply (not total) to avoid counting bridged tokens twice
   * - Bridge flows are properly netted: deposits reduce net supply, withdrawals increase it
   * - This maintains mathematical consistency where circulating ≤ total
   * 
   * **Critical**: This MUST use L2 net supply for mathematical consistency with total supply.
   * Using L2 total supply would create impossible scenarios where circulating > total.
   * 
   * ### 3. Locked Supply Calculation
   * **Formula**: `Reconciled Locked = L1 Locked Supply`
   * 
   * **Why this works**:
   * - Token locking (staking) currently only happens on L1
   * - L2 deposits are transfers, not locks - tokens remain liquid on L2
   * - Future L2 staking features would require updating this logic
   * 
   * ### 4. Liquid Supply Calculation
   * **Formula**: `Reconciled Liquid = Reconciled Total - Reconciled Locked`
   * 
   * **Why this works**:
   * - Standard accounting: liquid = total - locked
   * - Represents all tokens not locked in staking contracts
   * - Includes both circulating tokens and idle tokens in wallets
   * 
   * ### 5. Genesis Locked Supply
   * **Formula**: `Reconciled Genesis Locked = L1 Genesis Locked`
   * 
   * **Why this works**:
   * - Genesis locked supply is a historical baseline from L1 launch
   * - L2 doesn't affect this historical reference point
   * - Used for calculating staking rewards and protocol parameters
   * 
   * ## MATHEMATICAL RELATIONSHIPS
   * 
   * The following relationships must hold for valid reconciliation:
   * 1. `Total = Liquid + Locked` (standard accounting)
   * 2. `Circulating ≤ Total` (circulating cannot exceed total)
   * 3. `Circulating ≤ Liquid` (circulating cannot exceed liquid)
   * 4. `L2 Net = L2 Total - (L2 Deposited - L2 Withdrawn)` (net supply with bridge flows)
   * 5. `Reconciled Total = L1 Total + L2 Net` (avoids double counting)
   * 6. `Reconciled Circulating = L1 Circulating + L2 Net` (consistent with total)
   * 
   * ## DOUBLE COUNTING PREVENTION
   * 
   * The key insight is that tokens bridged between L1 and L2:
   * 
   * **L1→L2 Bridge Flow**:
   * 1. Remain counted in L1's totalSupply (they don't disappear from L1's ledger)
   * 2. Are included in L2's totalSupply (they appear on L2's ledger)
   * 3. Are subtracted in L2's netSupply calculation to avoid double counting
   * 
   * **L2→L1 Bridge Flow** (withdrawals):
   * 1. Tokens leave L2 but are still counted in L2's totalSupply temporarily
   * 2. Withdrawals are tracked separately in totalGRTWithdrawn
   * 3. Net calculation: L2 Net = L2 Total - (Deposits - Withdrawals)
   * 4. This properly accounts for tokens that went L1→L2→L1
   * 
   * **Result**: Each token is counted exactly once in the global supply calculation,
   * regardless of how many times it crossed the bridge.
   * 
   * ## BRIDGE TIMING AND WITHDRAWAL ACCOUNTING
   * 
   * **L2 Initiated vs L1 Confirmed Withdrawals**:
   * - L2 `totalGRTWithdrawn`: Tracks withdrawals when initiated on L2 (tokens immediately burned)
   * - L1 `totalGRTWithdrawnConfirmed`: Tracks withdrawals when confirmed on L1 (after 7-day challenge period)
   * - **Our Choice**: Use L2 initiated values for immediate token accounting accuracy
   * 
   * **Why L2 Initiated Values**:
   * 1. **Token State**: Once withdrawal is initiated, tokens are burned on L2 and should be counted
   * 2. **Supply Accuracy**: Tokens in the bridge challenge period still exist and need accounting
   * 3. **Consistency**: Provides "maximum possible" total supply including pending bridge transactions
   * 4. **Real-time**: Reflects actual token state without waiting for L1 confirmation delays
   * 
   * **Timing Difference Impact**:
   * - Typical difference: ~27M GRT (~0.24% of total supply)
   * - Represents tokens in bridge challenge period or pending confirmation
   * - This slight over-reporting ensures no tokens are missed in supply calculations
   */
  private reconcileSupplyData(l1Data: L1GlobalState, l2Data: L2SupplyData): ReconciledGlobalState {
    // ========== DATA CONVERSION ==========
    // Convert all values from wei (10^18 smallest units) to decimal numbers for calculation
    const l1TotalSupply = new Decimal(l1Data.totalSupply).dividedBy(DIVISION_NUMBER);
    const l1LockedSupply = new Decimal(l1Data.lockedSupply).dividedBy(DIVISION_NUMBER);
    const l1LockedSupplyGenesis = new Decimal(l1Data.lockedSupplyGenesis).dividedBy(DIVISION_NUMBER);
    const l1CirculatingSupply = new Decimal(l1Data.circulatingSupply).dividedBy(DIVISION_NUMBER);

    const l2GRTDeposited = new Decimal(l2Data.totalGRTDepositedConfirmed).dividedBy(DIVISION_NUMBER);
    const l2GRTWithdrawn = new Decimal(l2Data.totalGRTWithdrawn).dividedBy(DIVISION_NUMBER);
    const l2NetSupply = new Decimal(l2Data.netL2Supply).dividedBy(DIVISION_NUMBER);

    console.log(`Reconciliation: L1 Total=${l1TotalSupply.toString()}, L2 Net=${l2NetSupply.toString()}, L2 Deposited=${l2GRTDeposited.toString()}, L2 Withdrawn=${l2GRTWithdrawn.toString()}`);

    // ========== SUPPLY RECONCILIATION ==========
    
    // TOTAL SUPPLY: L1 total + L2 net (avoids double counting bridged tokens)
    const reconciledTotalSupply = l1TotalSupply.plus(l2NetSupply);
    
    // CIRCULATING SUPPLY: L1 circulating + L2 net (consistent with total supply)
    const reconciledCirculatingSupply = l1CirculatingSupply.plus(l2NetSupply);
    
    // LOCKED SUPPLY: Only L1 has staking/locking (L2 deposits are transfers, not locks)
    const reconciledLockedSupply = l1LockedSupply;
    
    // LIQUID SUPPLY: Mathematical relationship (total - locked = liquid)
    const reconciledLiquidSupply = reconciledTotalSupply.minus(reconciledLockedSupply);

    // ========== RESULT ASSEMBLY ==========
    const result = {
      totalSupply: reconciledTotalSupply.toNumber(),
      lockedSupply: reconciledLockedSupply.toNumber(),
      lockedSupplyGenesis: l1LockedSupplyGenesis.toNumber(), // Historical L1 baseline
      liquidSupply: reconciledLiquidSupply.toNumber(),
      circulatingSupply: reconciledCirculatingSupply.toNumber(),
      l1Breakdown: l1Data, // Preserve original L1 data for transparency
      l2Breakdown: l2Data, // Preserve original L2 data for transparency
      reconciliationTimestamp: Date.now(),
    };

    console.log(`Reconciled result: Total=${result.totalSupply}, Circulating=${result.circulatingSupply}, Locked=${result.lockedSupply}`);
    
    return result;
  }

  private async fetchL1DataWithRetry(): Promise<{ data: L1GlobalState; durationMs: number }> {
    const result = await globalRetryHandler.executeWithRetry(
      async () => await getLatestGlobalState(),
      "L1_LATEST_GLOBAL_STATE"
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to fetch L1 data");
    }

    return { data: result.data, durationMs: result.totalDurationMs };
  }

  private async fetchL2DataWithRetry(): Promise<{ data: L2SupplyData; durationMs: number }> {
    const result = await globalRetryHandler.executeWithRetry(
      async () => await getLatestL2Supply(this.config.l2SubgraphUrl),
      "L2_LATEST_SUPPLY"
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to fetch L2 data");
    }

    return { data: result.data, durationMs: result.totalDurationMs };
  }

  private async fetchL1DataByBlockWithRetry(blockNumber: number): Promise<{ data: L1GlobalState; durationMs: number }> {
    const result = await globalRetryHandler.executeWithRetry(
      async () => {
        const data = await getGlobalStateByBlockNumber(blockNumber);
        if (!data) {
          // Fallback to latest if block-specific data not found
          return await getLatestGlobalState();
        }
        return data;
      },
      "L1_BLOCK_GLOBAL_STATE"
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to fetch L1 data by block");
    }

    return { data: result.data, durationMs: result.totalDurationMs };
  }

  private async fetchL2DataByBlockWithRetry(blockNumber: number): Promise<{ data: L2SupplyData; durationMs: number }> {
    const result = await globalRetryHandler.executeWithRetry(
      async () => {
        const data = await getL2SupplyByBlockNumber(blockNumber, this.config.l2SubgraphUrl);
        if (!data) {
          // Fallback to latest if block-specific data not found
          return await getLatestL2Supply(this.config.l2SubgraphUrl);
        }
        return data;
      },
      "L2_BLOCK_SUPPLY"
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to fetch L2 data by block");
    }

    return { data: result.data, durationMs: result.totalDurationMs };
  }
}