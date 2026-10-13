import { describe, expect, test } from '@jest/globals';
import { handleRequest } from '../utils/flow';
import { createMockRequest } from './utils';
import { mockSupplyFetches, supplyOptions, l2Supply } from './supply-fixtures';

describe('Global state response', () => {
  test('converts supply values to GRT and preserves the raw L2 breakdown', async () => {
    mockSupplyFetches();
    const response = await handleRequest(createMockRequest('http://localhost/global-state'), supplyOptions);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      totalSupply: 1010,
      circulatingSupply: 810,
      lockedSupply: 200,
      lockedSupplyGenesis: 100,
      liquidSupply: 810,
      reconciliationTimestamp: expect.any(Number),
      l1Breakdown: {
        totalSupply: 1000,
        circulatingSupply: 800,
        lockedSupply: 200,
        lockedSupplyGenesis: 100,
        liquidSupply: 800,
      },
      l2Breakdown: { ...l2Supply, netL2Supply: '10000000000000000000' },
    });
    for (const field of ['totalSupply', 'circulatingSupply', 'lockedSupply', 'lockedSupplyGenesis', 'liquidSupply']) {
      expect(Number.isFinite(body[field])).toBe(true);
    }
  });
});
