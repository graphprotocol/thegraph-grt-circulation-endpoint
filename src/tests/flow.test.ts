import { describe, expect, test, jest } from '@jest/globals';
import { handleRequest } from '../utils/flow';
import { createMockRequest, mockFetch } from './utils';
import { mockSupplyFetches, supplyOptions } from './supply-fixtures';

describe('Request/Response flow with mocked upstream HTTP', () => {
  test.each([
    ['/token-supply', '1010'],
    ['/circulating-supply', '810'],
  ])('returns reconciled supply for %s', async (path, expected) => {
    mockSupplyFetches();
    const response = await handleRequest(createMockRequest(`http://localhost${path}`), supplyOptions);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(await response.text()).toBe(expected);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('returns historical data when the block lookup succeeds', async () => {
    mockFetch('GET', 'https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=1665295732&closest=before&apikey=test-etherscan-key', {
      status: '1', message: 'OK', result: { blockNumber: '15653542' },
    });
    mockSupplyFetches();
    const response = await handleRequest(createMockRequest('http://localhost/global-state?timestamp=1665295732'), supplyOptions);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalSupply: 1010, circulatingSupply: 810 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('returns latest global state without a timestamp', async () => {
    mockSupplyFetches();
    const response = await handleRequest(createMockRequest('http://localhost/global-state'), supplyOptions);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(await response.json()).toMatchObject({ totalSupply: 1010, lockedSupply: 200, circulatingSupply: 810 });
  });

  test('returns 503 when the historical block lookup fails', async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('Block lookup unavailable'));
    const response = await handleRequest(createMockRequest('http://localhost/global-state?timestamp=1665295732'), supplyOptions);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('Block lookup unavailable') });
  });

  test('returns 404 for an unknown path after successful reconciliation', async () => {
    mockSupplyFetches();
    const response = await handleRequest(createMockRequest('http://localhost/unknown-path'), supplyOptions);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'Endpoint /unknown-path not found.' });
  });
});
