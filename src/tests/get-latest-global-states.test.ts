import { describe, expect, test } from '@jest/globals';
import { mockFetch } from './utils';
import { l1Supply } from './supply-fixtures';
import { getLatestGlobalState } from '../utils/l1/global-states.graphql';

const url = 'https://gateway.thegraph.com/api/subgraphs/id/6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY';

describe('getLatestGlobalState', () => {
  test('returns the latest supply data', async () => {
    mockFetch('POST', url, { data: { globalStates: [l1Supply] } });
    await expect(getLatestGlobalState()).resolves.toEqual(l1Supply);
  });

  test('rejects GraphQL errors even when HTTP status is 200', async () => {
    mockFetch('POST', url, { errors: [{ message: 'Subgraph unavailable' }] });
    await expect(getLatestGlobalState()).rejects.toThrow('GraphQL Errors: Subgraph unavailable');
  });
});
