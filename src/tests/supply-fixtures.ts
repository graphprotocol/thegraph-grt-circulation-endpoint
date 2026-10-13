import { mockFetch } from './utils';

export const supplyOptions = {
  etherscanApiKey: 'test-etherscan-key',
  l2SubgraphUrl: 'https://l2.example.com/graphql',
  enableValidation: true,
};

// 1,000 L1 tokens, with 200 locked and 800 circulating.
export const l1Supply = {
  totalSupply: '1000000000000000000000',
  lockedSupply: '200000000000000000000',
  lockedSupplyGenesis: '100000000000000000000',
  liquidSupply: '800000000000000000000',
  circulatingSupply: '800000000000000000000',
};

// 80 L2 tokens = 100 deposited - 30 withdrawn + 10 newly minted.
export const l2Supply = {
  totalSupply: '80000000000000000000',
  totalGRTDepositedConfirmed: '100000000000000000000',
  totalGRTWithdrawn: '30000000000000000000',
};

export function mockSupplyFetches() {
  mockFetch('POST', 'https://gateway.thegraph.com/api/subgraphs/id/6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY', {
    data: { globalStates: [l1Supply] },
  });
  mockFetch('POST', supplyOptions.l2SubgraphUrl, {
    data: { graphNetworks: [l2Supply] },
  });
}
