/**
 * Raw GraphNetwork entity from The Graph Network Subgraph on Arbitrum One.
 * This is the direct response from the subgraph query.
 * 
 * Data Source: The Graph Network Subgraph on Arbitrum One
 * GraphQL Entity: GraphNetwork
 */
export interface GraphNetwork {
  /** Total GRT supply on L2 (bridged tokens + newly minted tokens) in wei */
  totalSupply: string;
  
  /** Confirmed GRT tokens bridged from L1 to L2 in wei */
  totalGRTDepositedConfirmed: string;
  
  /** Total GRT tokens withdrawn from L2 back to L1 (initiated on L2 side) in wei */
  totalGRTWithdrawn: string;
}

/**
 * GraphQL response wrapper for L2 subgraph queries.
 */
export interface L2GraphQLResponse {
  graphNetworks: GraphNetwork[];
}

/**
 * Processed L2 supply data with derived values for reconciliation.
 * All values are in wei (10^18 smallest units) as strings to preserve precision.
 * 
 * This interface includes calculated fields that are essential for proper L1+L2 reconciliation
 * to avoid double-counting tokens that were bridged between L1 and L2.
 */
export interface L2SupplyData {
  /** 
   * Total GRT supply on L2 = bridged tokens + newly minted tokens.
   * This includes all GRT that exists on L2, regardless of origin.
   */
  totalSupply: string;
  
  /** 
   * Confirmed GRT tokens that were bridged from L1 to L2.
   * These tokens still exist in L1's totalSupply count to maintain L1 accounting integrity.
   */
  totalGRTDepositedConfirmed: string;
  
  /** 
   * Total GRT tokens withdrawn from L2 back to L1 (initiated on L2 side).
   * These withdrawals reduce the net amount of tokens that should be considered "deposited".
   * Note: Uses L2-initiated values (immediate burn) rather than L1-confirmed (after challenge period).
   */
  totalGRTWithdrawn: string;
  
  /** 
   * Net new GRT tokens minted on L2 = totalSupply - (totalGRTDepositedConfirmed - totalGRTWithdrawn).
   * This represents ONLY the new tokens created on L2, properly accounting for the net bridge flow.
   * This is the key value used in reconciliation to avoid double-counting bridged tokens.
   */
  netL2Supply: string;
}

export interface L2FetchResult {
  success: boolean;
  data?: L2SupplyData;
  error?: string;
  timestamp: number;
}