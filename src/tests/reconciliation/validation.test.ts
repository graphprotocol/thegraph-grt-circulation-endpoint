import { describe, expect, test } from '@jest/globals';
import { validateL2Data } from '../../utils/reconciliation/validation';

describe('L2 bridge flow validation', () => {
  test.each([
    { supply: '80', deposited: '100', withdrawn: '30', netSupply: '10' },
    { supply: '70', deposited: '100', withdrawn: '30', netSupply: '0' },
    { supply: '110', deposited: '100', withdrawn: '0', netSupply: '10' },
  ])('accepts supply $supply with deposits $deposited and withdrawals $withdrawn', ({ supply, deposited, withdrawn, netSupply }) => {
    const result = validateL2Data({
      totalSupply: supply,
      totalGRTDepositedConfirmed: deposited,
      totalGRTWithdrawn: withdrawn,
      netL2Supply: netSupply,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test.each([
    { supply: '60', deposited: '100', withdrawn: '30', netSupply: '-10' },
    { supply: '90', deposited: '100', withdrawn: '0', netSupply: '-10' },
  ])('rejects supply $supply below net deposits with withdrawals $withdrawn', ({ supply, deposited, withdrawn, netSupply }) => {
    const result = validateL2Data({
      totalSupply: supply,
      totalGRTDepositedConfirmed: deposited,
      totalGRTWithdrawn: withdrawn,
      netL2Supply: netSupply,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('L2 net deposits'));
  });
});
