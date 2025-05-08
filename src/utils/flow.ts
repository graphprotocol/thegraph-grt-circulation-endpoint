// import jwt from "@tsndr/cloudflare-worker-jwt"; // Removed: No longer needed
import { AllGlobalStatesQuery } from "../types/global-states.graphql";
import { getBlockByTimestamp, getLatestBlock } from "./blocks-info.graphql";
import {
  getGlobalStateByBlockNumber,
  getLatestGlobalState,
} from "./global-states.graphql";
// import { validateAndExtractTokenFromRequest } from "./validate-and-extract-token-from-request"; // Removed: No longer needed
import { Decimal } from "decimal.js";

const DIVISION_NUMBER = 1000000000000000000;

export function createErrorResponse(message: string, status: number): Response {
  // Ensure this returns a standard Web API Response
  const body = JSON.stringify({ error: message });
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

type PatchResponse = {
  [Property in keyof Omit<
    AllGlobalStatesQuery["globalStates"][number],
    "__typename"
  >]: number;
};

function getDividedNumberFromResult(input: string) {
  return new Decimal(input).dividedBy(DIVISION_NUMBER).toNumber();
}

export function patchResponse(
  source: AllGlobalStatesQuery["globalStates"][number]
): PatchResponse {
  return {
    totalSupply: getDividedNumberFromResult(source.totalSupply),
    lockedSupply: getDividedNumberFromResult(source.lockedSupply),
    lockedSupplyGenesis: getDividedNumberFromResult(source.lockedSupplyGenesis),
    liquidSupply: getDividedNumberFromResult(source.liquidSupply),
    circulatingSupply: getDividedNumberFromResult(source.circulatingSupply),
  };
}

function createValidResponse(
  globalState: AllGlobalStatesQuery["globalStates"][number]
): Response {
  const patchedResponse = patchResponse(globalState);
  // Ensure this returns a standard Web API Response
  const body = JSON.stringify(patchedResponse);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createCirculatingSupplyResponse(
  globalState: AllGlobalStatesQuery["globalStates"][number]
): Response {
  const patchedResponse = patchResponse(globalState);
  // Ensure this returns a standard Web API Response
  return new Response(String(patchedResponse.circulatingSupply), {
    status: 200,
    headers: {
        "Content-Type": "text/plain", // Typically circulating supply is plain text
    }
  });
}

function createTotalsupplyResponse(
  globalState: AllGlobalStatesQuery["globalStates"][number]
): Response {
  const patchedResponse = patchResponse(globalState);
   // Ensure this returns a standard Web API Response
  return new Response(String(patchedResponse.totalSupply), {
    status: 200,
    headers: {
        "Content-Type": "text/plain", // Typically total supply is plain text
    }
  });
}

export async function handleRequest(
  request: import('express').Request, // This is an Express Request object
  options: {
    // jwtVerifySecret?: string; // Removed: No longer needed for public API
    etherscanApiKey: string;
  }
): Promise<Response> { // This should return a standard Web API Response
  try {
    // Construct the full URL if not already present on the Express request
    // Vercel and other platforms might provide this differently.
    // For Express, `request.protocol`, `request.get('host')`, `request.originalUrl` are common.
    // We need a full URL for `new URL()`.
    // Assuming the Express server is running at some base URL.
    // For local dev, it might be http://localhost:3000
    // For Vercel, it will be the deployment URL.
    // Let's try to construct it, or ensure `request.url` is what `new URL` expects.
    // Express `req.url` is usually just the path and query.
    // A common workaround for `new URL` is to provide a dummy base if only path is needed.
    const fullUrl = `http://${request.headers.host || 'localhost'}${request.originalUrl || request.url}`;
    const url = new URL(fullUrl);
    const params = Object.fromEntries(url.searchParams);
    const pathname = url.pathname;

    console.info(`Public request for ${pathname}.`);

    // Path-based routing for data fetching
    if (pathname.includes("/token-supply")) {
      const lastGlobalState = await getLatestGlobalState();
      console.log("Processing /token-supply request.");
      return createTotalsupplyResponse(lastGlobalState);
    }

    if (pathname.includes("/circulating-supply")) {
      const lastGlobalState = await getLatestGlobalState();
      console.log("Processing /circulating-supply request.");
      return createCirculatingSupplyResponse(lastGlobalState);
    }
    
    // Since all endpoints are public now, any other path is a 404
    // unless we add more specific routes.
    // The original logic for timestamp-based queries was tied to authentication.
    // If we want to keep timestamp queries public, we need to define their paths.
    // For now, let's assume only /token-supply and /circulating-supply are valid.

    // If we want to support the timestamp based query publicly on a specific path, e.g., /global-state
    if (pathname.includes("/global-state")) {
        const timestamp = params.timestamp ? parseInt(params.timestamp) : null;
        if (timestamp) {
          console.log(`Processing public request for timestamp: ${timestamp}`);
          const blockDetails = await getBlockByTimestamp(timestamp, options.etherscanApiKey).then(
            async (blockInfo) => {
              if (!blockInfo) return await getLatestBlock(options.etherscanApiKey);
              return blockInfo;
            }
          );
          const globalStateDetails = await getGlobalStateByBlockNumber(blockDetails).then(
            async (globalStateInfo) => {
              if (!globalStateInfo) return await getLatestGlobalState();
              return globalStateInfo;
            }
          );
          return createValidResponse(globalStateDetails);
        } else {
          // Default for /global-state if no timestamp
          console.log("Processing public request for latest global state.");
          const lastGlobalState = await getLatestGlobalState();
          return createValidResponse(lastGlobalState);
        }
    }

    return createErrorResponse(`Endpoint ${pathname} not found.`, 404);

  } catch (error) {
    console.error("Error in handleRequest:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return createErrorResponse(
      `Server error: ${errorMessage}`,
      500
    );
  }
}
