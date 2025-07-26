import { getLatestL2Supply, getL2SupplyByBlockNumber } from '../../utils/l2/supply-data.graphql';

// Mock the fetchGraphQL function
jest.mock('../../utils/fetch-graphql');

const mockFetchGraphQL = require('../../utils/fetch-graphql').fetchGraphQL;

describe('L2 Supply Data GraphQL', () => {
  const mockL2SubgraphUrl = 'https://gateway.thegraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockL2Response = {
    graphNetworks: [
      {
        totalSupply: '3344392801699562803941900360',
        totalGRTDepositedConfirmed: '3230297690874856963763373638',
      }
    ]
  };

  describe('getLatestL2Supply', () => {
    it('should fetch and transform L2 supply data correctly', async () => {
      mockFetchGraphQL.mockResolvedValue(mockL2Response);

      const result = await getLatestL2Supply(mockL2SubgraphUrl);

      expect(mockFetchGraphQL).toHaveBeenCalledWith({
        url: mockL2SubgraphUrl,
        query: expect.stringContaining('graphNetworks'),
        variables: {},
      });

      expect(result).toEqual({
        totalSupply: '3344392801699562803941900360',
        totalGRTDepositedConfirmed: '3230297690874856963763373638',
        netL2Supply: '114095110824705840178526722', // totalSupply - totalGRTDepositedConfirmed
      });
    });

    it('should throw error when no graph networks found', async () => {
      mockFetchGraphQL.mockResolvedValue({ graphNetworks: [] });

      await expect(getLatestL2Supply(mockL2SubgraphUrl)).rejects.toThrow(
        'No L2 GraphNetwork data found'
      );
    });

    it('should throw error when fetch fails', async () => {
      mockFetchGraphQL.mockRejectedValue(new Error('Network error'));

      await expect(getLatestL2Supply(mockL2SubgraphUrl)).rejects.toThrow(
        'Failed to fetch latest L2 supply data: Network error'
      );
    });
  });

  describe('getL2SupplyByBlockNumber', () => {
    it('should fetch L2 supply data for specific block', async () => {
      mockFetchGraphQL.mockResolvedValue(mockL2Response);

      const result = await getL2SupplyByBlockNumber(12345678, mockL2SubgraphUrl);

      expect(mockFetchGraphQL).toHaveBeenCalledWith({
        url: mockL2SubgraphUrl,
        query: expect.stringContaining('graphNetworks'),
        variables: { blockFilter: { number: 12345678 } },
      });

      expect(result).toEqual({
        totalSupply: '3344392801699562803941900360',
        totalGRTDepositedConfirmed: '3230297690874856963763373638',
        netL2Supply: '114095110824705840178526722',
      });
    });

    it('should fetch latest data when block number is null', async () => {
      mockFetchGraphQL.mockResolvedValue(mockL2Response);

      const result = await getL2SupplyByBlockNumber(null, mockL2SubgraphUrl);

      expect(mockFetchGraphQL).toHaveBeenCalledWith({
        url: mockL2SubgraphUrl,
        query: expect.stringContaining('graphNetworks'),
        variables: {},
      });

      expect(result).not.toBeNull();
    });

    it('should return null when no data found for block', async () => {
      mockFetchGraphQL.mockResolvedValue({ graphNetworks: [] });

      const result = await getL2SupplyByBlockNumber(12345678, mockL2SubgraphUrl);

      expect(result).toBeNull();
    });
  });

  describe('net L2 supply calculation', () => {
    it('should calculate positive net supply correctly', async () => {
      const response = {
        graphNetworks: [
          {
            totalSupply: '1000000000000000000000000000', // 1B GRT
            totalGRTDepositedConfirmed: '800000000000000000000000000', // 800M GRT
          }
        ]
      };
      
      mockFetchGraphQL.mockResolvedValue(response);

      const result = await getLatestL2Supply(mockL2SubgraphUrl);

      expect(result.netL2Supply).toBe('200000000000000000000000000'); // 200M GRT
    });

    it('should handle zero net supply', async () => {
      const response = {
        graphNetworks: [
          {
            totalSupply: '1000000000000000000000000000', // 1B GRT
            totalGRTDepositedConfirmed: '1000000000000000000000000000', // 1B GRT
          }
        ]
      };
      
      mockFetchGraphQL.mockResolvedValue(response);

      const result = await getLatestL2Supply(mockL2SubgraphUrl);

      expect(result.netL2Supply).toBe('0');
    });

    it('should handle negative net supply (edge case)', async () => {
      const response = {
        graphNetworks: [
          {
            totalSupply: '800000000000000000000000000', // 800M GRT
            totalGRTDepositedConfirmed: '1000000000000000000000000000', // 1B GRT
          }
        ]
      };
      
      mockFetchGraphQL.mockResolvedValue(response);

      const result = await getLatestL2Supply(mockL2SubgraphUrl);

      expect(result.netL2Supply).toBe('-200000000000000000000000000'); // -200M GRT
    });
  });
});