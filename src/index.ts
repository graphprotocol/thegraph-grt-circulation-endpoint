/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Env } from "./env";
import { handleRequest } from "./utils/flow";
import { getNewToken } from "./utils/getNewToken";
import { createToken } from "./utils/createToken";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Dedicated token management endpoints (usually POST)
    if (request.method === "POST" && pathname.endsWith("/get-new-token")) {
      return await getNewToken(request, env);
    }

    if (request.method === "POST" && pathname.endsWith("/create-token")) {
      return await createToken(request, env);
    }

    // Public data endpoints (GET)
    // Using .includes() for flexibility with trailing slashes, but ensure it's specific enough
    if (pathname.includes('/token-supply') || pathname.includes('/circulating-supply')) {
      console.log(`Routing to public handler for: ${pathname}`);
      return await handleRequest(request, {
        // jwtVerifySecret is NOT passed, making it undefined in handleRequest options
        etherscanApiKey: env.ETHERSCAN_API_KEY,
      });
    }
    
    // All other endpoints are considered authenticated
    console.log(`Routing to authenticated handler for: ${pathname}`);
    if (!env.JWT_VERIFY_SECRET) {
      // This case should ideally not happen if JWT_VERIFY_SECRET is configured for production
      // but it's a good safeguard.
      console.error("JWT_VERIFY_SECRET is not defined for an authenticated route!");
      return new Response(JSON.stringify({ error: "Server configuration error: JWT secret missing." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return await handleRequest(request, {
      jwtVerifySecret: env.JWT_VERIFY_SECRET, // Passed for authenticated routes
      etherscanApiKey: env.ETHERSCAN_API_KEY,
    });
  },
};
