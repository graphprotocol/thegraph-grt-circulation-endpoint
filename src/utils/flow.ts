import jwt from "@tsndr/cloudflare-worker-jwt";
import { AllGlobalStatesQuery } from "../types/global-states.graphql";
import { getBlockByTimestamp, getLatestBlock } from "./blocks-info.graphql";
import {
  getGlobalStateByBlockNumber,
  getLatestGlobalState,
} from "./global-states.graphql";
import { validateAndExtractTokenFromRequest } from "./validate-and-extract-token-from-request";
import { Decimal } from "decimal.js";

const DIVISION_NUMBER = 1000000000000000000;

export function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
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
  return new Response(JSON.stringify(patchedResponse), {
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
  return new Response(String(patchedResponse.circulatingSupply));
}

function createTotalsupplyResponse(
  globalState: AllGlobalStatesQuery["globalStates"][number]
): Response {
  const patchedResponse = patchResponse(globalState);
  return new Response(String(patchedResponse.totalSupply));
}

export async function handleRequest(
  request: Request,
  options: {
    jwtVerifySecret?: string; // Made optional
    etherscanApiKey: string;
  }
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const pathname = url.pathname;

    // Authentication: Only if jwtVerifySecret is provided (i.e., for routes index.ts deems private)
    if (options.jwtVerifySecret) {
      const token = validateAndExtractTokenFromRequest(request);
      if (!token) {
        return createErrorResponse("Missing Token (for authenticated route)", 400);
      }
      const isValid = await jwt.verify(token, options.jwtVerifySecret);
      if (!isValid) {
        return createErrorResponse("Invalid Token", 401);
      }
      console.info(`Authenticated request for ${pathname} passed validation.`);
    } else {
      console.info(`Public request for ${pathname} (no JWT verification needed as per calling context).`);
    }

    // Path-based routing for data fetching
    // Using .includes to be flexible with trailing slashes, matching index.ts
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

    // If we reach here, it's not /token-supply or /circulating-supply.
    // If it was a public call (options.jwtVerifySecret was undefined as per index.ts),
    // then it's an unknown public path because index.ts only marks /token-supply and /circulating-supply as public.
    if (!options.jwtVerifySecret) {
      return createErrorResponse(`Endpoint ${pathname} not found or not configured as public.`, 404);
    }

    // At this point, it must be an authenticated request (options.jwtVerifySecret was present and token validated)
    // for a path other than /token-supply or /circulating-supply. This is where timestamp logic applies.
    const timestamp = params.timestamp ? parseInt(params.timestamp) : null;
    if (timestamp) {
      console.log(`Processing authenticated request for timestamp: ${timestamp}`);
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
      // Default response for authenticated requests if no timestamp and not other specific data paths
      console.log("Processing default authenticated request (latest global state).");
      const lastGlobalState = await getLatestGlobalState();
      return createValidResponse(lastGlobalState);
    }

  } catch (error) {
    console.error("Error in handleRequest:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return createErrorResponse(
      `Server error: ${errorMessage}`,
      500
    );
  }
}
