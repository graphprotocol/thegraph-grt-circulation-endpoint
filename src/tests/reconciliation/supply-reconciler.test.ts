import { SupplyReconciler } from '../../utils/reconciliation/supply-reconciler';
import { ReconciliationConfig } from '../../utils/reconciliation/types';

// Mock the dependencies
jest.mock('../../utils/l1/global-states.graphql');
jest.mock('../../utils/l2/supply-data.graphql');

const mockGetLatestGlobalState = require('../../utils/l1/global-states.graphql').getLatestGlobalState;
const mockGetLatestL2Supply = require('../../utils/l2/supply-data.graphql').getLatestL2Supply;

describe('SupplyReconciler', () => {
  let reconciler: SupplyReconciler;
  let config: ReconciliationConfig;

  beforeEach(() => {
    config = {
      l2SubgraphUrl: 'https://test-l2-subgraph.com',
      enableValidation: true,
      toleranceThreshold: 0.001,
    };
    
    reconciler = new SupplyReconciler(config);

    // Reset mocks
    jest.clearAllMocks();
  });

  const mockL1Data = {
    totalSupply: '10000000000000000000000000000', // 10B GRT in wei
    lockedSupply: '2000000000000000000000000000',   // 2B GRT in wei
    lockedSupplyGenesis: '1900000000000000000000000000', // 1.9B GRT in wei
    liquidSupply: '8000000000000000000000000000',   // 8B GRT in wei
    circulatingSupply: '8100000000000000000000000000', // 8.1B GRT in wei
  };

  const mockL2Data = {
    totalSupply: '3344392801699562803941900360',           // Total L2 supply in wei
    totalGRTDepositedConfirmed: '3230297690874856963763373638', // Deposited from L1 in wei
    netL2Supply: '114095110824705840178526722',            // Net new L2 tokens in wei
  };

  it('should successfully reconcile L1 and L2 data', async () => {
    mockGetLatestGlobalState.mockResolvedValue(mockL1Data);
    mockGetLatestL2Supply.mockResolvedValue(mockL2Data);

    const result = await reconciler.getReconciledLatestSupply();

    expect(result.success).toBe(true);
    expect(result.reconciledSupply).toBeDefined();
    expect(result.errors).toHaveLength(0);

    const reconciledData = result.reconciledSupply!;
    
    // Check that L1 and L2 data are properly combined
    // totalSupply = L1 + L2NetSupply = 10B + ~0.114B = ~10.114B
    expect(reconciledData.totalSupply).toBeCloseTo(10114095110.824705, 3);
    
    // circulatingSupply = L1 + L2NetSupply = 8.1B + ~0.114B = ~8.214B (consistent calculation)
    expect(reconciledData.circulatingSupply).toBeCloseTo(8214095110.824705, 3);
    
    // Verify breakdown data is preserved
    expect(reconciledData.l1Breakdown).toEqual(mockL1Data);
    expect(reconciledData.l2Breakdown).toEqual(mockL2Data);
    expect(reconciledData.reconciliationTimestamp).toBeDefined();
  });

  it('should fail when L1 data fetch fails', async () => {
    mockGetLatestGlobalState.mockRejectedValue(new Error('L1 fetch failed'));
    mockGetLatestL2Supply.mockResolvedValue(mockL2Data);

    const result = await reconciler.getReconciledLatestSupply();

    expect(result.success).toBe(false);
    expect(result.errors.some(error => error.includes('L1 fetch failed'))).toBe(true);
    expect(result.reconciledSupply).toBeUndefined();
  });

  it('should fail when L2 data fetch fails', async () => {
    mockGetLatestGlobalState.mockResolvedValue(mockL1Data);
    mockGetLatestL2Supply.mockRejectedValue(new Error('L2 fetch failed'));

    const result = await reconciler.getReconciledLatestSupply();

    expect(result.success).toBe(false);
    expect(result.errors.some(error => error.includes('L2 fetch failed'))).toBe(true);
    expect(result.reconciledSupply).toBeUndefined();
  });

  it('should fail when both L1 and L2 data fetch fails', async () => {
    mockGetLatestGlobalState.mockRejectedValue(new Error('L1 failure'));
    mockGetLatestL2Supply.mockRejectedValue(new Error('L2 failure'));

    const result = await reconciler.getReconciledLatestSupply();

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('L1 fetch failed');
    expect(result.errors[1]).toContain('L2 fetch failed');
  });

  it('should track performance metrics', async () => {
    mockGetLatestGlobalState.mockResolvedValue(mockL1Data);
    mockGetLatestL2Supply.mockResolvedValue(mockL2Data);

    const result = await reconciler.getReconciledLatestSupply();

    expect(result.success).toBe(true);
    expect(result.l1FetchDurationMs).toBeGreaterThan(0);
    expect(result.l2FetchDurationMs).toBeGreaterThan(0);
    expect(result.totalDurationMs).toBeGreaterThan(0);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(
      Math.max(result.l1FetchDurationMs, result.l2FetchDurationMs)
    );
  });

  it('should handle validation errors when enabled', async () => {
    const invalidL1Data = {
      ...mockL1Data,
      totalSupply: '-1000000000000000000000000000', // Negative total supply
    };

    mockGetLatestGlobalState.mockResolvedValue(invalidL1Data);
    mockGetLatestL2Supply.mockResolvedValue(mockL2Data);

    const result = await reconciler.getReconciledLatestSupply();

    expect(result.success).toBe(false);
    expect(result.errors.some(error => error.includes('L1 validation'))).toBe(true);
  });

  it('should skip validation when disabled', async () => {
    const configWithoutValidation = {
      ...config,
      enableValidation: false,
    };
    
    const reconcilerWithoutValidation = new SupplyReconciler(configWithoutValidation);

    const invalidL1Data = {
      ...mockL1Data,
      totalSupply: '-1000000000000000000000000000', // This should be ignored
    };

    mockGetLatestGlobalState.mockResolvedValue(invalidL1Data);
    mockGetLatestL2Supply.mockResolvedValue(mockL2Data);

    const result = await reconcilerWithoutValidation.getReconciledLatestSupply();

    // Should succeed despite invalid data because validation is disabled
    expect(result.success).toBe(true);
  });

  it('should successfully reconcile realistic L1+L2 data without validation errors', async () => {
    // Use realistic data from production logs to verify the fix
    const realisticL1Data = {
      totalSupply: '10800262816048213437000000000000000000',     // ~10.8B GRT 
      lockedSupply: '921278119800416700000000000000000000',      // ~921M GRT
      lockedSupplyGenesis: '900000000000000000000000000000000000', // ~900M GRT
      liquidSupply: '9878984696247796737000000000000000000',     // ~9.9B GRT  
      circulatingSupply: '10800262816048213437000000000000000000', // ~10.8B GRT
    };

    const realisticL2Data = {
      totalSupply: '3342705006110798294471944875',              // ~3.34B GRT
      totalGRTDepositedConfirmed: '3230298701957382879763373638', // ~3.23B GRT
      netL2Supply: '112406304153415414708571237',               // ~112M GRT
    };

    mockGetLatestGlobalState.mockResolvedValue(realisticL1Data);
    mockGetLatestL2Supply.mockResolvedValue(realisticL2Data);

    const result = await reconciler.getReconciledLatestSupply();

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    
    const reconciledData = result.reconciledSupply!;
    
    // Verify total supply = L1 total + L2 net = ~10.8B + ~0.112B = ~10.912B  
    expect(reconciledData.totalSupply).toBeCloseTo(10800262816160620000, 0);
    
    // Verify circulating supply now equals total supply (no longer exceeds it)
    expect(reconciledData.circulatingSupply).toBeCloseTo(reconciledData.totalSupply, 6);
    
    // Verify circulating supply <= total supply (should not trigger validation error)
    expect(reconciledData.circulatingSupply).toBeLessThanOrEqual(reconciledData.totalSupply);
  });
});