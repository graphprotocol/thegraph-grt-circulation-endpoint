# The Graph GRT Circulation Endpoint

A deterministic L1+L2 GRT supply reconciliation service that provides accurate token circulation data by combining Layer 1 (Ethereum) and Layer 2 network data.

## Overview

This service fetches GRT token supply data from both:
- **Layer 1**: The Graph GRT Supply Subgraph (includes vesting schedules and inflation tracking)
- **Layer 2**: The Graph Network Subgraph on Arbitrum One (includes bridge transactions and L2 minting)

The reconciliation logic ensures no double-counting while providing comprehensive supply data across both layers.

## Features

- **🔄 Deterministic Logic**: Requires both L1 and L2 data for accurate results
- **⚡ Parallel Fetching**: L1 and L2 data fetched simultaneously for performance
- **🛡️ Robust Error Handling**: Exponential backoff with circuit breaker pattern
- **📊 Rich Monitoring**: Performance metrics and health endpoints
- **✅ Data Validation**: Cross-layer consistency checks
- **🧪 Comprehensive Testing**: Unit, integration, and reconciliation tests

## API Endpoints

### Supply Data (L1+L2 Reconciled)
- `GET /token-supply` - Returns total supply (L1 + L2 net supply)
- `GET /circulating-supply` - Returns circulating supply (L1 + L2 net supply)
- `GET /global-state` - Returns full breakdown with L1/L2 data
- `GET /global-state?timestamp=1640995200` - Historical reconciled data

### Health & Monitoring
- `GET /health/l1` - L1 layer health and circuit breaker status
- `GET /health/l2` - L2 layer health and circuit breaker status  
- `GET /health/combined` - Overall system health
- `GET /config` - Current configuration status
- `GET /ping` - Basic health check for load balancers

## Setup

### Prerequisites
- Node.js 18+
- Etherscan API key
- pnpm (preferred) or yarn

### Installation
```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
```

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

### Development
```bash
# Start development server
pnpm dev

# Run tests
pnpm test
pnpm test:reconciliation
pnpm test:l2

# Build for production
pnpm build
pnpm start
```

## Reconciliation Logic

### Data Sources
- **L1 GRT Supply Subgraph**: `totalSupply`, `circulatingSupply`, `lockedSupply` (includes vesting and inflation)
- **L2 Graph Network Subgraph**: `totalSupply`, `totalGRTDepositedConfirmed`, `totalGRTWithdrawn`

### Bridge Flow Accounting
The key insight is properly handling L1↔L2 bridge flows to avoid double-counting:

```typescript
// L2 net supply (new tokens minted on L2, accounting for bridge flows)
netL2Supply = L2.totalSupply - (L2.totalGRTDepositedConfirmed - L2.totalGRTWithdrawn)

// Combined totals (avoiding double counting)
totalSupply = L1.totalSupply + netL2Supply
circulatingSupply = L1.circulatingSupply + netL2Supply
lockedSupply = L1.lockedSupply  // L2 deposits are transfers, not locks
```

### Why This Works
- **L1→L2 Deposits**: Counted in L1 total, subtracted from L2 net to avoid double counting
- **L2→L1 Withdrawals**: Burned on L2, added back to L2 net calculation for accuracy
- **L2 Net Supply**: Represents only new tokens minted on L2, not bridged tokens

### Example Response
```json
{
  "totalSupply": 10586449198.7,
  "circulatingSupply": 11503848555.1,
  "lockedSupply": 248151617.15,
  "liquidSupply": 10338297581.5,
  "reconciliationTimestamp": 1640995200000,
  "l1Breakdown": {
    "totalSupply": 10472259308.43,
    "circulatingSupply": 8065857537.24,
    "lockedSupply": 248151617.15,
    "liquidSupply": 799107691.27
  },
  "l2Breakdown": {
    "totalSupply": "3344392801699562803941900360",
    "totalGRTDepositedConfirmed": "3230297690874856963763373638",
    "netL2Supply": "114095110824705840178526722"
  }
}
```

## Error Handling

The system uses deterministic error handling:
- **All-or-Nothing**: Must have both L1 and L2 data to succeed
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Circuit Breaker**: Prevents cascade failures after 5 consecutive failures
- **HTTP 503**: Returned when either L1 or L2 layer fails

## Deployment

### Vercel
```bash
# Deploy to Vercel
pnpm deploy

# Or configure in vercel.json
{
  "env": {
    "L2_SUBGRAPH_URL": "https://gateway.thegraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp"
  }
}
```

### Docker/Generic
```bash
# Build
pnpm build

# Set environment variables
export ETHERSCAN_API_KEY=your_key
export L2_SUBGRAPH_URL=https://gateway.thegraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp

# Start
pnpm start
```

## Monitoring

The service provides detailed metrics:
- L1/L2 fetch times and success rates
- Circuit breaker status per service
- Reconciliation performance metrics
- Cross-layer validation warnings

Monitor the `/health/combined` endpoint for overall system status.

## Architecture

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

## License

This project is licensed under the MIT License.