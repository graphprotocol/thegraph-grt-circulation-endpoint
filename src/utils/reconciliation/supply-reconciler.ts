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

  private reconcileSupplyData(l1Data: L1GlobalState, l2Data: L2SupplyData): ReconciledGlobalState {
    // Convert L1 data from wei to decimal numbers
    const l1TotalSupply = new Decimal(l1Data.totalSupply).dividedBy(DIVISION_NUMBER);
    const l1LockedSupply = new Decimal(l1Data.lockedSupply).dividedBy(DIVISION_NUMBER);
    const l1LockedSupplyGenesis = new Decimal(l1Data.lockedSupplyGenesis).dividedBy(DIVISION_NUMBER);
    const l1LiquidSupply = new Decimal(l1Data.liquidSupply).dividedBy(DIVISION_NUMBER);
    const l1CirculatingSupply = new Decimal(l1Data.circulatingSupply).dividedBy(DIVISION_NUMBER);

    // Convert L2 data from wei to decimal numbers
    const l2TotalSupply = new Decimal(l2Data.totalSupply).dividedBy(DIVISION_NUMBER);
    const l2GRTDeposited = new Decimal(l2Data.totalGRTDepositedConfirmed).dividedBy(DIVISION_NUMBER);
    const l2NetSupply = new Decimal(l2Data.netL2Supply).dividedBy(DIVISION_NUMBER);

    console.log(`Reconciliation: L1 Total=${l1TotalSupply.toString()}, L2 Net=${l2NetSupply.toString()}, L2 Deposited=${l2GRTDeposited.toString()}`);

    // Reconciliation Logic:
    // 1. L1 totalSupply already includes deposited tokens that went to L2
    // 2. L2 netSupply = L2 totalSupply - L2 deposited = new tokens minted on L2
    // 3. Combined totalSupply = L1 totalSupply + L2 netSupply (to avoid double counting)
    const reconciledTotalSupply = l1TotalSupply.plus(l2NetSupply);
    
    // For circulating supply:
    // - L1 circulating supply excludes tokens locked/deposited to L2
    // - L2 total supply includes all L2 tokens (deposited + newly minted)
    // - Combined circulating = L1 circulating + L2 total supply
    const reconciledCirculatingSupply = l1CirculatingSupply.plus(l2TotalSupply);
    
    // For locked supply:
    // - Keep L1 locked supply as-is (tokens locked on L1)
    // - L2 deposits are not "locked" in the traditional sense, they're transferred
    const reconciledLockedSupply = l1LockedSupply;
    
    // Liquid supply = total - locked
    const reconciledLiquidSupply = reconciledTotalSupply.minus(reconciledLockedSupply);

    const result = {
      totalSupply: reconciledTotalSupply.toNumber(),
      lockedSupply: reconciledLockedSupply.toNumber(),
      lockedSupplyGenesis: l1LockedSupplyGenesis.toNumber(), // L2 doesn't affect genesis locked supply
      liquidSupply: reconciledLiquidSupply.toNumber(),
      circulatingSupply: reconciledCirculatingSupply.toNumber(),
      l1Breakdown: l1Data,
      l2Breakdown: l2Data,
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