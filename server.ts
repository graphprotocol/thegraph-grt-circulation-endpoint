import express, { Express, Request, Response } from 'express'; // Reverted to standard ES6 import
import { handleRequest } from './src/utils/flow'; // Reverted to no extension
import { Env } from './src/env'; // Reverted to no extension
import * as dotenv from 'dotenv'; // Changed import style

// Load environment variables from .env
dotenv.config();

// Create Express app
const app: Express = express();
const port = process.env.PORT || 3000;

// Convert Cloudflare Worker's Env to Node.js environment variables
const env: Env = {
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',
  JWT_VERIFY_SECRET: process.env.JWT_VERIFY_SECRET || '', // Will be ignored for public routes
  TOKEN_CREATION_PASSWORD: process.env.TOKEN_CREATION_PASSWORD || ''
};

// Public routes
app.get('/token-supply', async (req: Request, res: Response) => {
  try {
    const webApiResponse = await handleRequest(req, { etherscanApiKey: env.ETHERSCAN_API_KEY });
    // Set headers from the Web API Response to the Express response
    webApiResponse.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });
    res.status(webApiResponse.status);
    if (webApiResponse.body) {
      // Convert ReadableStream to buffer/string to send with Express
      const reader = webApiResponse.body.getReader();
      let chunks: Uint8Array[] = []; // Explicitly type chunks
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
    console.error("Error in /token-supply route:", error); // Log the specific error
    res.status(500).send('Internal Server Error');
  }
});

app.get('/circulating-supply', async (req: Request, res: Response) => {
  try {
    const webApiResponse = await handleRequest(req, { etherscanApiKey: env.ETHERSCAN_API_KEY });
    // Set headers from the Web API Response to the Express response
    webApiResponse.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });
    res.status(webApiResponse.status);
    if (webApiResponse.body) {
      // Convert ReadableStream to buffer/string to send with Express
      const reader = webApiResponse.body.getReader();
      let chunks: Uint8Array[] = []; // Explicitly type chunks
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
    console.error("Error in /circulating-supply route:", error); // Log the specific error
    res.status(500).send('Internal Server Error');
  }
});

// Start server for local development
if (process.env.NODE_ENV !== 'production') { // Only listen locally
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app; // Export the app for Vercel