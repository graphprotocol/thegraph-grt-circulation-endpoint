import { handleRequest } from '../../utils/flow-new';
import { createMockRequest } from '../utils';

// Mock the reconciliation system
jest.mock('../../utils/reconciliation/supply-reconciler');

const mockSupplyReconciler = require('../../utils/reconciliation/supply-reconciler').SupplyReconciler;

describe('L1+L2 Flow Integration', () => {
  const mockOptions = {
    etherscanApiKey: 'test-etherscan-key',
    l2SubgraphUrl: 'https://test-l2-subgraph.com',
    retryMaxAttempts: 3,
    retryBaseDelayMs: 100,
    enableValidation: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful reconciliation by default
    mockSupplyReconciler.mockImplementation(() => ({
      getReconciledLatestSupply: jest.fn().mockResolvedValue({
        success: true,
        reconciledSupply: {
          totalSupply: 10500000000,
          circulatingSupply: 8400000000,
          lockedSupply: 2100000000,
          lockedSupplyGenesis: 1900000000,
          liquidSupply: 8400000000,
          l1Breakdown: {
            totalSupply: '10000000000000000000000000000',
            circulatingSupply: '8100000000000000000000000000',
            lockedSupply: '2000000000000000000000000000',
            lockedSupplyGenesis: '1900000000000000000000000000',
            liquidSupply: '8000000000000000000000000000',
          },
          l2Breakdown: {
            l2Minted: '500000000000000000000000000',
            l2Burned: '100000000000000000000000000',
            l2Circulating: '300000000000000000000000000',
            l2Locked: '100000000000000000000000000',
          },
          reconciliationTimestamp: Date.now(),
        },
        errors: [],
        l1FetchDurationMs: 150,
        l2FetchDurationMs: 200,
        totalDurationMs: 350,
      }),
      getReconciledSupplyByTimestamp: jest.fn().mockResolvedValue({
        success: true,
        reconciledSupply: {
          totalSupply: 10400000000,
          circulatingSupply: 8300000000,
          lockedSupply: 2100000000,
          lockedSupplyGenesis: 1900000000,
          liquidSupply: 8300000000,
          l1Breakdown: {
            totalSupply: '9950000000000000000000000000',
            circulatingSupply: '8050000000000000000000000000',
            lockedSupply: '2000000000000000000000000000',
            lockedSupplyGenesis: '1900000000000000000000000000',
            liquidSupply: '7950000000000000000000000000',
          },
          l2Breakdown: {
            l2Minted: '450000000000000000000000000',
            l2Burned: '50000000000000000000000000',
            l2Circulating: '250000000000000000000000000',
            l2Locked: '100000000000000000000000000',
          },
          reconciliationTimestamp: Date.now(),
        },
        errors: [],
        l1FetchDurationMs: 180,
        l2FetchDurationMs: 220,
        totalDurationMs: 400,
      }),
    }));
  });

  describe('/token-supply endpoint', () => {
    it('should return reconciled total supply as plain text', async () => {
      const request = createMockRequest('http://localhost:3000/token-supply');
      
      const response = await handleRequest(request, mockOptions);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain');
      
      const responseText = await response.text();
      expect(responseText).toBe('10500000000');
    });

    it('should handle timestamp parameter for total supply', async () => {
      const request = createMockRequest('http://localhost:3000/token-supply?timestamp=1640995200');
      
      const response = await handleRequest(request, mockOptions);
      
      expect(response.status).toBe(200);
      
      const responseText = await response.text();
      expect(responseText).toBe('10400000000');
    });
  });

  describe('/circulating-supply endpoint', () => {
    it('should return reconciled circulating supply as plain text', async () => {
      const request = createMockRequest('http://localhost:3000/circulating-supply');
      
      const response = await handleRequest(request, mockOptions);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain');
      
      const responseText = await response.text();
      expect(responseText).toBe('8400000000');
    });
  });

  describe('/global-state endpoint', () => {
    it('should return full reconciled state with breakdown', async () => {
      const request = createMockRequest('http://localhost:3000/global-state');
      
      const response = await handleRequest(request, mockOptions);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const responseData = await response.json();
      
      expect(responseData).toMatchObject({
        totalSupply: 10500000000,
        circulatingSupply: 8400000000,
        lockedSupply: 2100000000,
        lockedSupplyGenesis: 1900000000,
        liquidSupply: 8400000000,
        reconciliationTimestamp: expect.any(Number),
        l1Breakdown: {
          totalSupply: 10000000000,
          circulatingSupply: 8100000000,
          lockedSupply: 2000000000,
          lockedSupplyGenesis: 1900000000,
          liquidSupply: 8000000000,
        },
        l2Breakdown: {
          l2Minted: '500000000000000000000000000',
          l2Burned: '100000000000000000000000000',
          l2Circulating: '300000000000000000000000000',
          l2Locked: '100000000000000000000000000',
        },
      });
    });
  });

  describe('Error handling', () => {
    it('should return 503 when reconciliation fails', async () => {
      // Mock reconciliation failure
      mockSupplyReconciler.mockImplementation(() => ({
        getReconciledLatestSupply: jest.fn().mockResolvedValue({
          success: false,
          errors: ['L1 fetch failed: Network timeout', 'L2 fetch failed: Invalid response'],
          l1FetchDurationMs: 5000,
          l2FetchDurationMs: 0,
          totalDurationMs: 5000,
        }),
      }));

      const request = createMockRequest('http://localhost:3000/token-supply');
      
      const response = await handleRequest(request, mockOptions);
      
      expect(response.status).toBe(503);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const errorData = await response.json();
      expect(errorData.error).toContain('Failed to fetch deterministic supply data');
      expect(errorData.timestamp).toBeDefined();
    });

    it('should return 404 for unknown endpoints', async () => {
      const request = createMockRequest('http://localhost:3000/unknown-endpoint');
      
      const response = await handleRequest(request, mockOptions);
      
      expect(response.status).toBe(404);
      
      const errorData = await response.json();
      expect(errorData.error).toContain('Endpoint /unknown-endpoint not found');
    });
  });

  describe('Health endpoints', () => {
    it('should return health status for combined endpoint', async () => {
      const request = createMockRequest('http://localhost:3000/health/combined');
      
      const response = await handleRequest(request, mockOptions);
      
      expect(response.status).toBe(200);
      
      const healthData = await response.json();
      expect(healthData).toMatchObject({
        status: 'healthy',
        service: 'L1+L2 Combined',
        circuitBreakers: expect.any(Object),
        timestamp: expect.any(String),
      });
    });
  });
});