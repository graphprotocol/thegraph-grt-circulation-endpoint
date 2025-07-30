# L1+L2 GRT Supply Reconciliation Implementation

## Overview

This service provides deterministic L1+L2 supply reconciliation for The Graph's GRT token. It fetches data from both Layer 1 (Ethereum mainnet) and Layer 2 (Arbitrum One) networks, combining them to provide accurate, comprehensive token supply metrics without double-counting bridged tokens.

## Architecture

### Core Components

1. **L1 Data Layer** (`src/utils/l1/`)
   - Fetches GRT supply data from The Graph GRT Supply Subgraph
   - Includes vesting schedules, token locks, and inflation tracking
   - Provides totalSupply, circulatingSupply, lockedSupply metrics

2. **L2 Data Layer** (`src/utils/l2/`)
   - Fetches L2 supply data from The Graph Network Subgraph on Arbitrum One
   - Tracks bridge transactions, deposits, withdrawals, and L2 minting
   - Calculates net L2 supply accounting for bridge flows

3. **Reconciliation Engine** (`src/utils/reconciliation/`)
   - **SupplyReconciler**: Core logic for combining L1 and L2 data
   - **RetryHandler**: Exponential backoff with circuit breaker pattern
   - **Validation**: Cross-layer data consistency checks and mathematical validation

### Data Sources

- **L1**: The Graph GRT Supply Subgraph (`6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY`)
- **L2**: The Graph Network Subgraph (`DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp`)

## Configuration

### Environment Variables

```bash
# Required
ETHERSCAN_API_KEY=your_etherscan_api_key
L2_SUBGRAPH_URL=https://gateway.thegraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp

# Optional
PORT=3000
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY_MS=1000
ENABLE_SUPPLY_VALIDATION=true
```

### Development Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start development server
pnpm dev

# Run tests
pnpm test
```

## API Endpoints

### Supply Data (L1+L2 Reconciled)

- **`GET /token-supply`** - Returns total supply (L1 + L2 net supply)
- **`GET /circulating-supply`** - Returns circulating supply (L1 + L2 net supply)
- **`GET /global-state`** - Returns full reconciled metrics with L1/L2 breakdown
- **`GET /global-state?timestamp=1640995200`** - Historical reconciled data

### Health & Monitoring

- **`GET /health/l1`** - L1 layer health and circuit breaker status
- **`GET /health/l2`** - L2 layer health and circuit breaker status  
- **`GET /health/combined`** - Overall system health
- **`GET /config`** - Current configuration status
- **`GET /ping`** - Basic health check for load balancers

## Reconciliation Logic

### Bridge Flow Accounting

The core challenge is properly handling L1↔L2 bridge flows to avoid double-counting tokens:

```typescript
// L2 net supply calculation (accounts for bridge flows)
netL2Supply = L2.totalSupply - (L2.totalGRTDepositedConfirmed - L2.totalGRTWithdrawn)

// Combined calculations
totalSupply = L1.totalSupply + netL2Supply
circulatingSupply = L1.circulatingSupply + netL2Supply
lockedSupply = L1.lockedSupply  // L2 deposits are transfers, not locks
```

### Why This Works

- **L1→L2 Deposits**: Remain in L1 totalSupply, subtracted from L2 net to avoid double counting
- **L2→L1 Withdrawals**: Burned on L2, added back to L2 net calculation for accuracy
- **L2 Net Supply**: Represents only new tokens minted on L2, not bridged tokens

### Withdrawal Timing

The system uses L2-initiated withdrawals rather than L1-confirmed withdrawals:
- **L2 Initiated**: Tokens immediately burned on L2 (our choice)
- **L1 Confirmed**: Tokens confirmed after 7-day challenge period
- **Difference**: ~27M GRT (~0.24% of total supply) representing pending bridge transactions

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
│  Bridge Flow Accounting     │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│      API Response           │
│  (With L1/L2 breakdown)     │
└─────────────────────────────┘
```

## Error Handling

### Deterministic Behavior

- **All-or-Nothing**: Requires both L1 and L2 data to succeed
- **No Partial Data**: Returns HTTP 503 if either layer fails
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Circuit Breaker**: Prevents cascade failures after consecutive failures

### Validation Rules

- `circulatingSupply ≤ totalSupply`
- `totalSupply = liquidSupply + lockedSupply`
- `L2 netSupply = L2 totalSupply - (deposits - withdrawals)`

## Testing

### Test Coverage

```bash
# All tests
pnpm test

# Specific test suites
pnpm test:reconciliation  # Reconciliation logic
pnpm test:l2             # L2 data fetching
pnpm test:integration    # End-to-end flows
```

### Key Test Areas

1. **Reconciliation Logic**: L1+L2 data combination accuracy
2. **Bridge Flow Accounting**: Withdrawal and deposit handling
3. **Validation**: Mathematical consistency checks
4. **Retry Logic**: Exponential backoff and circuit breaker behavior
5. **Error Scenarios**: L1/L2 failure handling

## Production Results

The system successfully reconciles GRT supply across both layers:

- **Total Supply**: ~11.31B GRT (within 0.24% of expected values)
- **Mathematical Consistency**: All validation rules pass
- **Bridge Accounting**: Properly handles ~398M GRT in withdrawals
- **Performance**: Parallel fetching with sub-second response times

This implementation provides the most accurate view of The Graph's token economics by accounting for vesting schedules, protocol inflation, and cross-layer bridge flows.