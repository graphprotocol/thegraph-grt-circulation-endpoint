# L1+L2 GRT Supply Reconciliation Implementation

## Overview

This implementation adds **deterministic L1+L2 supply reconciliation** to the GRT circulation endpoint. The system now fetches data from both Layer 1 (Ethereum mainnet) and Layer 2 networks, combining them to provide accurate token supply metrics.

## Architecture

### Key Components

1. **L1 Data Layer** (`src/utils/l1/`)
   - Fetches GRT supply data from The Graph's L1 subgraph
   - Maintains existing GlobalState structure
   - Uses established Etherscan integration for block queries

2. **L2 Data Layer** (`src/utils/l2/`)
   - Fetches L2-specific supply data (structure TBD based on your queries)
   - Handles L2 subgraph endpoint configuration
   - Transforms L2 data to reconciliation format

3. **Reconciliation Engine** (`src/utils/reconciliation/`)
   - **SupplyReconciler**: Core logic for combining L1 and L2 data
   - **RetryHandler**: Exponential backoff with circuit breaker pattern
   - **Validation**: Cross-layer data consistency checks

4. **Enhanced Flow** (`src/utils/flow-new.ts`)
   - **Deterministic Requirement**: Must have both L1 and L2 data
   - Parallel fetching with retry logic
   - Enhanced error handling and performance metrics

## Configuration

### Environment Variables

```bash
# Existing
ETHERSCAN_API_KEY=your_etherscan_api_key
PORT=3000

# New L2 Configuration
L2_SUBGRAPH_URL=https://your-l2-subgraph-endpoint.com
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY_MS=1000
ENABLE_SUPPLY_VALIDATION=true
```

### Usage

1. **Update Environment**:
   ```bash
   # Add to your .env file
   L2_SUBGRAPH_URL=https://your-l2-subgraph-endpoint.com
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Run with L1+L2 Reconciliation**:
   ```bash
   # Development (using new server)
   pnpm dev:l1l2
   
   # Production build
   pnpm build:l1l2
   pnpm start:l1l2
   ```

## API Endpoints

### Supply Endpoints (Now with L1+L2 reconciliation)

- **`GET /token-supply`** - Returns reconciled total supply (L1 + L2)
- **`GET /circulating-supply`** - Returns reconciled circulating supply (L1 + L2) 
- **`GET /global-state`** - Returns full reconciled metrics with L1/L2 breakdown
- **`GET /global-state?timestamp=1640995200`** - Historical reconciled data

### Health & Monitoring

- **`GET /health/l1`** - L1 layer health and circuit breaker status
- **`GET /health/l2`** - L2 layer health and circuit breaker status  
- **`GET /health/combined`** - Overall system health
- **`GET /config`** - Current configuration status
- **`GET /ping`** - Basic health check for load balancers

## Data Flow

```
┌─────────────┐    ┌─────────────┐
│   L1 Fetch  │    │   L2 Fetch  │
│ (Parallel)  │    │ (Parallel)  │
└──────┬──────┘    └──────┬──────┘
       │                  │
       ▼                  ▼
┌─────────────────────────────┐
│    Retry Handler with       │
│    Exponential Backoff      │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│      Data Validation        │
│   (L1, L2, Cross-layer)     │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│     Supply Reconciler       │
│  totalSupply = L1 + L2Net   │
│ circulatingSupply = L1 + L2 │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│      API Response           │
│  (Plain text or JSON with   │
│   L1/L2 breakdown)          │
└─────────────────────────────┘
```

## Error Handling

### Deterministic Behavior

- **All-or-Nothing**: Requires both L1 and L2 data to succeed
- **No Partial Data**: Returns HTTP 503 if either layer fails
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Circuit Breaker**: Prevents cascade failures after 5 consecutive failures

### Error Responses

```json
{
  "error": "Failed to fetch deterministic supply data: L1 fetch failed: Network timeout; L2 fetch failed: Invalid response",
  "timestamp": "2025-01-25T10:30:00.000Z"
}
```

## Testing

### Run Tests

```bash
# All tests
pnpm test

# Specific test suites
pnpm test reconciliation
pnpm test integration
pnpm test retry-handler
```

### Key Test Areas

1. **Retry Logic**: Exponential backoff, circuit breaker behavior
2. **Reconciliation**: L1+L2 data combination accuracy
3. **Integration**: End-to-end API behavior
4. **Error Scenarios**: L1/L2 failure handling
5. **Performance**: Fetch timing and parallel execution

## Next Steps

### ✅ Implementation Complete

The L1+L2 reconciliation system is now fully implemented with:

1. **Real L2 Subgraph**: `https://gateway.theuggraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp`
2. **L2 GraphQL Query**: `graphNetworks` query for `totalSupply` and `totalGRTDepositedConfirmed`
3. **L2 Data Structure**: GraphNetwork with deposited GRT tracking
4. **Reconciliation Logic**: 
   - Total Supply = L1 Total + L2 Net Supply (avoiding double counting)
   - Circulating Supply = L1 Circulating + L2 Total Supply
   - Net L2 Supply = L2 Total - L2 Deposited (new tokens minted on L2)

### Reconciliation Formula

Based on your L2 data structure:
```
L2 Example Data:
- totalSupply: 3,344,392,801.7 GRT (total L2 supply)
- totalGRTDepositedConfirmed: 3,230,297,690.9 GRT (deposited from L1)
- netL2Supply: 114,095,110.8 GRT (new tokens minted on L2)

Combined Calculations:
- Total Supply = L1_Total + L2_Net (avoids double counting deposits)
- Circulating Supply = L1_Circulating + L2_Total (L2 tokens are circulating)
- Locked Supply = L1_Locked (L2 deposits are transfers, not locks)
```

### Production Deployment

1. **Feature Flag**: Deploy with feature flag to compare L1-only vs L1+L2 results
2. **Monitoring**: Set up alerts for circuit breaker triggers and high error rates
3. **Performance**: Monitor L1/L2 fetch times and optimize if needed
4. **Validation**: Compare reconciled results with expected values

ARR! The foundation be solid and ready for your L2 queries, captain! 🏴‍☠️