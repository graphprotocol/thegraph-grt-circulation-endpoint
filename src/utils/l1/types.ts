/**
 * L1 Global State data from The Graph GRT Supply Subgraph on Ethereum mainnet.
 * All values are in wei (10^18 smallest units) as strings to preserve precision.
 * 
 * Data Source: The Graph GRT Supply Subgraph (ID: 6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY)
 * GraphQL Entity: GlobalState
 */
export interface L1GlobalState {
  /** Total GRT tokens ever minted on L1. Includes tokens that have been bridged to L2. */
  totalSupply: string;
  
  /** GRT tokens locked in staking contracts on L1. Used for Indexer and Delegator staking. */
  lockedSupply: string;
  
  /** Historical baseline of locked tokens from protocol genesis. Used for rewards calculation. */
  lockedSupplyGenesis: string;
  
  /** GRT tokens available for circulation on L1 (not locked in staking). */
  liquidSupply: string;
  
  /** GRT tokens actively circulating on L1. May be less than liquid due to idle tokens. */
  circulatingSupply: string;
}

export interface L1FetchResult {
  success: boolean;
  data?: L1GlobalState;
  error?: string;
  timestamp: number;
}