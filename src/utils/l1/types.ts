export interface L1GlobalState {
  totalSupply: string;
  lockedSupply: string;
  lockedSupplyGenesis: string;
  liquidSupply: string;
  circulatingSupply: string;
}

export interface L1FetchResult {
  success: boolean;
  data?: L1GlobalState;
  error?: string;
  timestamp: number;
}