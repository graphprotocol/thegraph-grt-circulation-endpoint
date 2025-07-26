export interface Env {
  JWT_VERIFY_SECRET?: string; // Make this optional
  TOKEN_CREATION_PASSWORD: string;
  ETHERSCAN_API_KEY: string;
  L2_SUBGRAPH_URL: string; // Required for L1+L2 reconciliation
  RETRY_MAX_ATTEMPTS?: string;
  RETRY_BASE_DELAY_MS?: string;
  ENABLE_SUPPLY_VALIDATION?: string;
}
