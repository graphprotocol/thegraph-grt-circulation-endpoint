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

// This file is no longer the main entry point for Vercel deployment.
// See server.ts for the Express server setup.
// The logic below is specific to Cloudflare Workers.

export default {
  async fetch(
    request: Request, // This is the standard Web API Request
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Dedicated token management endpoints (usually POST)
    if (request.method === "POST" && pathname.endsWith("/get-new-token")) {
      // For Cloudflare, getNewToken expects a standard Request and Env
      return await getNewToken(request, env);
    }

    if (request.method === "POST" && pathname.endsWith("/create-token")) {
      // For Cloudflare, createToken expects a standard Request and Env
      return await createToken(request, env);
    }

    // Public data endpoints (GET)
    if (pathname.includes('/token-supply') || pathname.includes('/circulating-supply')) {
      console.log(`Routing to public handler for: ${pathname}`);
      // handleRequest now expects an Express Request, so we cast to `any`
      // if we were to call it directly from here in a mixed environment.
      // However, for Vercel, server.ts is the entry point.
      return await handleRequest(request as any, { // Cast to any to satisfy the new signature
        etherscanApiKey: env.ETHERSCAN_API_KEY,
      });
    }
    
    // All other endpoints are considered authenticated
    console.log(`Routing to authenticated handler for: ${pathname}`);
    if (!env.JWT_VERIFY_SECRET) {
      console.error("JWT_VERIFY_SECRET is not defined for an authenticated route!");
      return new Response(JSON.stringify({ error: "Server configuration error: JWT secret missing." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    // As above, casting to `any` for handleRequest if called from here.
    // Removed jwtVerifySecret from options as it's no longer part of the handleRequest signature
    return await handleRequest(request as any, { // Cast to any to satisfy the new signature
      etherscanApiKey: env.ETHERSCAN_API_KEY,
    });
  },
};
