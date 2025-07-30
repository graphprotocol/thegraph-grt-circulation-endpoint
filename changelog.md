# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **2025-07-26:**
    - **L1+L2 Deterministic Supply Reconciliation**: Complete rewrite to support both Layer 1 and Layer 2 GRT supply data.
        - Added L2 subgraph integration (`https://gateway.thegraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp`).
        - Implemented `SupplyReconciler` with deterministic L1+L2 data combination logic.
        - Added robust retry mechanism with exponential backoff and circuit breaker pattern.
        - Created comprehensive data validation for L1, L2, and cross-layer consistency checks.
    - **New API Endpoints**:
        - `/health/l1` - L1 layer health and circuit breaker status
        - `/health/l2` - L2 layer health and circuit breaker status
        - `/health/combined` - Overall system health monitoring
        - `/config` - Configuration status endpoint for debugging
        - `/ping` - Basic health check for load balancers
    - **Enhanced Monitoring**: Performance metrics, fetch timings, and circuit breaker status tracking.
    - **Comprehensive Test Suite**: Unit tests for reconciliation logic, retry handling, and L2 integration.

### Changed
- **2025-07-26:**
    - **BREAKING**: All endpoints now return L1+L2 reconciled data instead of L1-only data.
    - **BREAKING**: `L2_SUBGRAPH_URL` environment variable is now required.
    - **Enhanced Reconciliation Logic**:
        - Total Supply = L1 Total + L2 Net Supply (avoids double counting deposited tokens)
        - Circulating Supply = L1 Circulating + L2 Total Supply
        - Locked Supply = L1 Locked only (L2 deposits are transfers, not locks)
    - Restructured codebase with modular L1/L2/reconciliation architecture:
        - `src/utils/l1/` - L1-specific data fetching and types
        - `src/utils/l2/` - L2-specific GraphNetwork queries and data transformation
        - `src/utils/reconciliation/` - Core reconciliation engine with retry and validation
    - Updated `/global-state` endpoint to include L1/L2 breakdown in response.
    - Server startup now validates both `ETHERSCAN_API_KEY` and `L2_SUBGRAPH_URL` are configured.

### Removed
- **2025-07-26:**
    - **Legacy L1-only logic**: Completely removed old supply calculation methods.
    - Eliminated dual-version support and backward compatibility code.
    - Removed unused files: `server-new.ts`, `flow-new.ts`, and migration guides.
    - Cleaned up package.json scripts to remove L1/L2 version distinction.

### Fixed
- **2025-07-27:**
    - **Critical L2 Withdrawal Accounting Bug**: Fixed major reconciliation error where L2→L1 withdrawals were not properly accounted for in net supply calculations.
        - **Root Cause**: L2 net supply calculation only considered deposits (`totalGRTDepositedConfirmed`) but ignored withdrawals (`totalGRTWithdrawn`), causing ~370M GRT to be double-counted.
        - **Impact**: Total supply was underreported by ~3.4% (~371M GRT), showing ~10.9B instead of expected ~11.28B.
        - **Solution**: Added `totalGRTWithdrawn` to L2 GraphQL queries and updated net supply formula to: `L2 Net = L2 Total - (Deposits - Withdrawals)`.
        - **Bridge Timing**: Uses L2-initiated withdrawals (immediately burned on L2) rather than L1-confirmed withdrawals for proper token accounting.
        - **Validation**: Mathematical reconciliation now correctly validates that `circulatingSupply ≤ totalSupply`.
    - **Enhanced Documentation**: Completely rewrote reconciliation logic documentation with accurate bridge flow accounting and double-counting prevention explanations.
- **2025-07-26:**
    - TypeScript compilation errors with Promise.allSettled result handling.
    - Import path issues after codebase restructuring.
    - Missing GraphQL type definitions for L1 global states.

### Previous Changes
- **2025-05-07:**
    - Updated the `grt-circulating-supply` subgraph endpoint to `https://gateway.thegraph.com/api/subgraphs/id/6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY`.
    - Added Authorization header with a bearer token for requests to the new `grt-circulating-supply` subgraph endpoint.
    - Updated mock URLs in `grt-circulating-supply` test files (`get-all-global-states.test.ts`, `get-latest-global-states.test.ts`) to reflect the new endpoint.
    - Replaced `blocklytics/ethereum-blocks` subgraph usage with Etherscan API for fetching Ethereum block numbers by timestamp and the latest block number.
        - Updated `src/utils/blocks-info.graphql.ts` to use Etherscan API.
        - Added `ETHERSCAN_API_KEY` to `src/env.ts`.
        - Updated `src/utils/flow.ts` to pass the Etherscan API key.
        - Rewrote tests in `src/tests/get-all-blocks-info.test.ts` and `src/tests/get-latest-block.test.ts` to mock `fetch` for Etherscan API calls.
    - Adjusted `tsconfig.json` to resolve TypeScript errors related to DOM and WebWorker typings.
    - Ensured `pnpm` is used for installing dependencies.