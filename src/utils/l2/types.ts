export interface GraphNetwork {
  totalSupply: string;
  totalGRTDepositedConfirmed: string;
}

export interface L2GraphQLResponse {
  graphNetworks: GraphNetwork[];
}

export interface L2SupplyData {
  totalSupply: string;           // Total GRT supply on L2
  totalGRTDepositedConfirmed: string; // Confirmed deposited GRT from L1 to L2
  // Derived values for reconciliation
  netL2Supply: string;          // totalSupply - totalGRTDepositedConfirmed (new tokens minted on L2)
}

export interface L2FetchResult {
  success: boolean;
  data?: L2SupplyData;
  error?: string;
  timestamp: number;
}