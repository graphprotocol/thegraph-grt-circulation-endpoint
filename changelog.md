# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
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