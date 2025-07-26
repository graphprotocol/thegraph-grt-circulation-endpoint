import { L1GlobalState } from "../l1/types";
import { L2SupplyData } from "../l2/types";
import { ReconciledGlobalState } from "./types";
import { Decimal } from "decimal.js";

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateL1Data(l1Data: L1GlobalState): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Validate all values are positive numbers
    const fields = ['totalSupply', 'lockedSupply', 'lockedSupplyGenesis', 'liquidSupply', 'circulatingSupply'];
    
    for (const field of fields) {
      const value = l1Data[field as keyof L1GlobalState];
      if (!value || value === '0') {
        warnings.push(`L1 ${field} is empty or zero`);
      } else {
        const decimal = new Decimal(value);
        if (decimal.isNegative()) {
          errors.push(`L1 ${field} cannot be negative: ${value}`);
        }
      }
    }

    // Validate L1 supply relationships
    const totalSupply = new Decimal(l1Data.totalSupply);
    const lockedSupply = new Decimal(l1Data.lockedSupply);
    const liquidSupply = new Decimal(l1Data.liquidSupply);
    const circulatingSupply = new Decimal(l1Data.circulatingSupply);

    // totalSupply should equal lockedSupply + liquidSupply (approximately)
    const calculatedTotal = lockedSupply.plus(liquidSupply);
    const totalDifference = totalSupply.minus(calculatedTotal).abs();
    const tolerance = totalSupply.mul(0.001); // 0.1% tolerance

    if (totalDifference.gt(tolerance)) {
      warnings.push(`L1 supply relationship inconsistency: totalSupply (${totalSupply}) != lockedSupply + liquidSupply (${calculatedTotal})`);
    }

    // circulatingSupply should be <= totalSupply
    if (circulatingSupply.gt(totalSupply)) {
      errors.push(`L1 circulatingSupply (${circulatingSupply}) cannot exceed totalSupply (${totalSupply})`);
    }

  } catch (error) {
    errors.push(`L1 validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

export function validateL2Data(l2Data: L2SupplyData): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Validate L2 data structure based on actual GraphNetwork data
    if (!l2Data.totalSupply || !l2Data.totalGRTDepositedConfirmed) {
      errors.push('L2 data is incomplete: missing totalSupply or totalGRTDepositedConfirmed');
    }

    // Validate positive values
    const fields = ['totalSupply', 'totalGRTDepositedConfirmed', 'netL2Supply'];
    
    for (const field of fields) {
      const value = l2Data[field as keyof L2SupplyData];
      if (value) {
        const decimal = new Decimal(value);
        if (decimal.isNegative()) {
          errors.push(`L2 ${field} cannot be negative: ${value}`);
        }
      }
    }

    // L2-specific validation logic
    if (l2Data.totalSupply && l2Data.totalGRTDepositedConfirmed) {
      const totalSupply = new Decimal(l2Data.totalSupply);
      const deposited = new Decimal(l2Data.totalGRTDepositedConfirmed);
      
      // Total supply should be >= deposited (can't have more deposited than total)
      if (deposited.gt(totalSupply)) {
        errors.push(`L2 totalGRTDepositedConfirmed (${deposited}) cannot exceed totalSupply (${totalSupply})`);
      }
      
      // Net supply should equal totalSupply - deposited
      if (l2Data.netL2Supply) {
        const expectedNetSupply = totalSupply.minus(deposited);
        const actualNetSupply = new Decimal(l2Data.netL2Supply);
        
        if (!expectedNetSupply.equals(actualNetSupply)) {
          warnings.push(`L2 netL2Supply (${actualNetSupply}) doesn't match calculated value (${expectedNetSupply})`);
        }
      }
      
      // Warn if net supply is negative (more deposited than total - unusual)
      const netSupply = totalSupply.minus(deposited);
      if (netSupply.isNegative()) {
        warnings.push(`L2 net supply is negative (${netSupply}) - more GRT deposited than total supply`);
      }
    }

  } catch (error) {
    errors.push(`L2 validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

export function validateReconciledData(
  reconciledData: ReconciledGlobalState,
  l1Data: L1GlobalState,
  l2Data: L2SupplyData
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Validate that reconciled values are reasonable
    if (reconciledData.totalSupply <= 0) {
      errors.push('Reconciled totalSupply must be positive');
    }

    if (reconciledData.circulatingSupply < 0) {
      errors.push('Reconciled circulatingSupply cannot be negative');
    }

    if (reconciledData.circulatingSupply > reconciledData.totalSupply) {
      errors.push('Reconciled circulatingSupply cannot exceed totalSupply');
    }

    // Validate that reconciled data includes L1 contributions
    const l1TotalSupply = new Decimal(l1Data.totalSupply).dividedBy('1000000000000000000').toNumber();
    
    if (reconciledData.totalSupply < l1TotalSupply * 0.99) { // L1 should contribute at least 99% of previous value
      warnings.push('Reconciled totalSupply appears lower than expected based on L1 data');
    }

    // Cross-validation checks
    const supplySum = reconciledData.lockedSupply + reconciledData.liquidSupply;
    const totalDifference = Math.abs(reconciledData.totalSupply - supplySum);
    const tolerance = reconciledData.totalSupply * 0.001; // 0.1% tolerance

    if (totalDifference > tolerance) {
      warnings.push(`Reconciled supply relationship inconsistency: totalSupply (${reconciledData.totalSupply}) != lockedSupply + liquidSupply (${supplySum})`);
    }

  } catch (error) {
    errors.push(`Reconciliation validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}