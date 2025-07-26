import express, { Express, Request, Response } from 'express';
import { handleRequest } from './src/utils/flow';
import { Env } from './src/env';
import * as dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

// Create Express app
const app: Express = express();
const port = process.env.PORT || 3000;

// Environment configuration with L1+L2 support
const env: Env = {
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',
  JWT_VERIFY_SECRET: process.env.JWT_VERIFY_SECRET || '',
  TOKEN_CREATION_PASSWORD: process.env.TOKEN_CREATION_PASSWORD || '',
  L2_SUBGRAPH_URL: process.env.L2_SUBGRAPH_URL || 'https://gateway.thegraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp',
  RETRY_MAX_ATTEMPTS: process.env.RETRY_MAX_ATTEMPTS || '3',
  RETRY_BASE_DELAY_MS: process.env.RETRY_BASE_DELAY_MS || '1000',
  ENABLE_SUPPLY_VALIDATION: process.env.ENABLE_SUPPLY_VALIDATION || 'true',
};

// Validate required environment variables
if (!env.ETHERSCAN_API_KEY) {
  console.error('ETHERSCAN_API_KEY is required');
  process.exit(1);
}

if (!env.L2_SUBGRAPH_URL) {
  console.error('L2_SUBGRAPH_URL is required for L1+L2 reconciliation');
  process.exit(1);
}

// Shared request handler with L1+L2 reconciliation
async function handleRouteRequest(req: Request, res: Response) {
  try {
    const webApiResponse = await handleRequest(req, {
      etherscanApiKey: env.ETHERSCAN_API_KEY,
      l2SubgraphUrl: env.L2_SUBGRAPH_URL!,
      retryMaxAttempts: parseInt(env.RETRY_MAX_ATTEMPTS || '3'),
      retryBaseDelayMs: parseInt(env.RETRY_BASE_DELAY_MS || '1000'),
      enableValidation: env.ENABLE_SUPPLY_VALIDATION?.toLowerCase() === 'true',
    });

    // Set headers from the Web API Response to the Express response
    webApiResponse.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });
    
    res.status(webApiResponse.status);
    
    if (webApiResponse.body) {
      // Convert ReadableStream to buffer/string to send with Express
      const reader = webApiResponse.body.getReader();
      let chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const responseBody = Buffer.concat(chunks).toString('utf-8');
      res.send(responseBody);
    } else {
      res.send();
    }
  } catch (error) {
    console.error(`Error in route handler:`, error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to process request with L1+L2 reconciliation',
      timestamp: new Date().toISOString(),
    });
  }
}

// Public supply endpoints (now with L1+L2 reconciliation)
app.get('/token-supply', handleRouteRequest);
app.get('/circulating-supply', handleRouteRequest);
app.get('/global-state', handleRouteRequest);

// Health check endpoints
app.get('/health', handleRouteRequest);
app.get('/health/l1', handleRouteRequest);
app.get('/health/l2', handleRouteRequest);
app.get('/health/combined', handleRouteRequest);

// General health endpoint for load balancers
app.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: 'L1+L2-reconciliation',
  });
});

// Configuration info endpoint (for debugging)
app.get('/config', (req: Request, res: Response) => {
  res.status(200).json({
    l2SubgraphConfigured: !!env.L2_SUBGRAPH_URL,
    etherscanConfigured: !!env.ETHERSCAN_API_KEY,
    retryConfig: {
      maxAttempts: parseInt(env.RETRY_MAX_ATTEMPTS || '3'),
      baseDelayMs: parseInt(env.RETRY_BASE_DELAY_MS || '1000'),
    },
    validationEnabled: env.ENABLE_SUPPLY_VALIDATION?.toLowerCase() === 'true',
    timestamp: new Date().toISOString(),
  });
});

// Start server for local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`🚀 GRT Supply Reconciliation Server running on port ${port}`);
    console.log(`📊 L1+L2 deterministic supply calculation enabled`);
    console.log(`🔄 Retry configuration: ${env.RETRY_MAX_ATTEMPTS} attempts, ${env.RETRY_BASE_DELAY_MS}ms base delay`);
    console.log(`✅ Supply validation: ${env.ENABLE_SUPPLY_VALIDATION === 'true' ? 'enabled' : 'disabled'}`);
  });
}

export default app;