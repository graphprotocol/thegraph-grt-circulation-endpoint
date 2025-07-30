import { SupplyReconciler } from "./reconciliation/supply-reconciler";
import { ReconciliationConfig } from "./reconciliation/types";
import { RetryHandler } from "./reconciliation/retry-handler";

export function createErrorResponse(message: string, status: number): Response {
  const body = JSON.stringify({ 
    error: message,
    timestamp: new Date().toISOString(),
  });
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createTotalSupplyResponse(totalSupply: number): Response {
  return new Response(String(totalSupply), {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    }
  });
}

function createCirculatingSupplyResponse(circulatingSupply: number): Response {
  return new Response(String(circulatingSupply), {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    }
  });
}

function createGlobalStateResponse(reconciledData: any): Response {
  // Create response with reconciled data and breakdown
  const responseBody = {
    totalSupply: reconciledData.totalSupply,
    lockedSupply: reconciledData.lockedSupply,
    lockedSupplyGenesis: reconciledData.lockedSupplyGenesis,
    liquidSupply: reconciledData.liquidSupply,
    circulatingSupply: reconciledData.circulatingSupply,
    reconciliationTimestamp: reconciledData.reconciliationTimestamp,
    l1Breakdown: {
      totalSupply: Number((Number(reconciledData.l1Breakdown.totalSupply) / 1e18).toFixed(6)),
      lockedSupply: Number((Number(reconciledData.l1Breakdown.lockedSupply) / 1e18).toFixed(6)),
      lockedSupplyGenesis: Number((Number(reconciledData.l1Breakdown.lockedSupplyGenesis) / 1e18).toFixed(6)),
      liquidSupply: Number((Number(reconciledData.l1Breakdown.liquidSupply) / 1e18).toFixed(6)),
      circulatingSupply: Number((Number(reconciledData.l1Breakdown.circulatingSupply) / 1e18).toFixed(6)),
    },
    l2Breakdown: reconciledData.l2Breakdown,
  };

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function handleRequest(
  request: import('express').Request,
  options: {
    etherscanApiKey: string;
    l2SubgraphUrl: string;
    retryMaxAttempts?: number;
    retryBaseDelayMs?: number;
    enableValidation?: boolean;
  }
): Promise<Response> {
  try {
    // Construct URL for routing
    const fullUrl = `http://${request.headers.host || 'localhost'}${request.originalUrl || request.url}`;
    const url = new URL(fullUrl);
    const params = Object.fromEntries(url.searchParams);
    const pathname = url.pathname;

    console.info(`Deterministic L1+L2 request for ${pathname}`);

    // Create reconciliation config
    const reconciliationConfig: ReconciliationConfig = {
      l2SubgraphUrl: options.l2SubgraphUrl,
      enableValidation: options.enableValidation ?? true,
      toleranceThreshold: 0.001, // 0.1% tolerance for validation
    };

    // Create retry handler with custom config if provided
    const retryHandler = new RetryHandler({
      maxAttempts: options.retryMaxAttempts || 3,
      baseDelayMs: options.retryBaseDelayMs || 1000,
    });

    const reconciler = new SupplyReconciler(reconciliationConfig);

    // Handle timestamp-based queries
    const timestamp = params.timestamp ? parseInt(params.timestamp) : null;

    let reconciliationResult;
    if (timestamp) {
      console.log(`Processing request with timestamp: ${timestamp}`);
      reconciliationResult = await reconciler.getReconciledSupplyByTimestamp(timestamp, options.etherscanApiKey);
    } else {
      console.log("Processing request for latest data");
      reconciliationResult = await reconciler.getReconciledLatestSupply();
    }

    // Check if reconciliation was successful
    if (!reconciliationResult.success) {
      console.error("Reconciliation failed:", reconciliationResult.errors);
      
      // Log performance metrics
      console.log(`Performance metrics - L1: ${reconciliationResult.l1FetchDurationMs}ms, L2: ${reconciliationResult.l2FetchDurationMs}ms, Total: ${reconciliationResult.totalDurationMs}ms`);
      
      return createErrorResponse(
        `Failed to fetch deterministic supply data: ${reconciliationResult.errors.join("; ")}`,
        503 // Service Unavailable
      );
    }

    const reconciledData = reconciliationResult.reconciledSupply!;

    // Log performance metrics for successful requests
    console.log(`Reconciliation successful - L1: ${reconciliationResult.l1FetchDurationMs}ms, L2: ${reconciliationResult.l2FetchDurationMs}ms, Total: ${reconciliationResult.totalDurationMs}ms`);

    // Route to appropriate response format
    if (pathname.includes("/token-supply")) {
      console.log("Returning total supply response");
      return createTotalSupplyResponse(reconciledData.totalSupply);
    }

    if (pathname.includes("/circulating-supply")) {
      console.log("Returning circulating supply response");
      return createCirculatingSupplyResponse(reconciledData.circulatingSupply);
    }

    if (pathname.includes("/global-state")) {
      console.log("Returning full global state response");
      return createGlobalStateResponse(reconciledData);
    }

    // Health check endpoints
    if (pathname.includes("/health")) {
      const circuitBreakerStatus = retryHandler.getCircuitBreakerStatus();
      
      if (pathname.includes("/health/l1")) {
        return new Response(JSON.stringify({
          status: "healthy",
          service: "L1",
          circuitBreaker: circuitBreakerStatus["L1_LATEST_GLOBAL_STATE"] || { count: 0, isOpen: false },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (pathname.includes("/health/l2")) {
        return new Response(JSON.stringify({
          status: "healthy", 
          service: "L2",
          circuitBreaker: circuitBreakerStatus["L2_LATEST_SUPPLY"] || { count: 0, isOpen: false },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (pathname.includes("/health/combined")) {
        const allHealthy = Object.values(circuitBreakerStatus).every(status => !status.isOpen);
        
        return new Response(JSON.stringify({
          status: allHealthy ? "healthy" : "degraded",
          service: "L1+L2 Combined",
          circuitBreakers: circuitBreakerStatus,
          timestamp: new Date().toISOString(),
        }), {
          status: allHealthy ? 200 : 503,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return createErrorResponse(`Endpoint ${pathname} not found.`, 404);

  } catch (error) {
    console.error("Critical error in handleRequest:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return createErrorResponse(
      `Critical server error: ${errorMessage}`,
      500
    );
  }
}