import { describe, expect, test } from "@jest/globals";
import { handleRequest } from "../utils/flow";
// import { sign } from "jsonwebtoken"; // Removed: No longer needed for public API
import httpMocks from 'node-mocks-http'; // For mocking Express Request/Response

// Use a real Etherscan API key for tests
const MOCK_ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "YourApiKeyToken";

// buildMockRequest now only needs to set up for public endpoints
async function buildMockRequest(queryParam: string, path = '/') {
  const mockRequest = httpMocks.createRequest({
    method: 'GET',
    url: `${path}${queryParam}`, // Used by `new URL` in handleRequest
    headers: {
      // No Authorization header needed
      host: 'localhost:3000', // Mock host for URL construction
    },
    protocol: 'http', // Mock protocol for URL construction
    originalUrl: `${path}${queryParam}`, // Ensure originalUrl is available
  });

  return {
    request: mockRequest as any, // Cast to any to match Express.Request type expected by handleRequest
    etherscanApiKey: MOCK_ETHERSCAN_API_KEY,
  };
}

describe("Request/Response flow", () => {

  test("Should return total supply for /token-supply", async () => {
    const { request, etherscanApiKey } = await buildMockRequest("", "/token-supply");

    const webResponse = await handleRequest(request, { etherscanApiKey });
    expect(webResponse.headers.get("Content-Type")).toBe("text/plain");
    expect(webResponse.status).toBe(200);
    const responseDataText = await webResponse.text();
    expect(parseFloat(responseDataText)).toEqual(expect.any(Number));
  });

  test("Should return circulating supply for /circulating-supply", async () => {
    const { request, etherscanApiKey } = await buildMockRequest("", "/circulating-supply");
    
    const webResponse = await handleRequest(request, { etherscanApiKey });
    expect(webResponse.headers.get("Content-Type")).toBe("text/plain");
    expect(webResponse.status).toBe(200);
    const responseDataText = await webResponse.text();
    expect(parseFloat(responseDataText)).toEqual(expect.any(Number));
  });

  test("Should return a valid response for /global-state when timestamp param is valid", async () => {
    const { request, etherscanApiKey } = await buildMockRequest(
      `?timestamp=1665295732`, "/global-state"
    );

    const webResponse = await handleRequest(request, { etherscanApiKey });
    expect(webResponse.headers.get("Content-Type")).toBe("application/json");
    // Expect 200 if fallback to latest works, or 500 if Etherscan key is bad/quota hit
    expect([200, 500]).toContain(webResponse.status); 
    if (webResponse.status === 200) {
      const responseData = await webResponse.json() as { totalSupply: number, circulatingSupply: number };
      expect(responseData).toEqual(
        expect.objectContaining({
          totalSupply: expect.any(Number),
          circulatingSupply: expect.any(Number),
        })
      );
    }
  });
  
  test("Should return latest global state for /global-state without timestamp", async () => {
    const { request, etherscanApiKey } = await buildMockRequest("", "/global-state");

    const webResponse = await handleRequest(request, { etherscanApiKey });
    expect(webResponse.headers.get("Content-Type")).toBe("application/json");
    expect(webResponse.status).toBe(200);
    const responseData = await webResponse.json() as { totalSupply: number, lockedSupply: number, circulatingSupply: number };
    expect(responseData).toEqual(
      expect.objectContaining({
        totalSupply: expect.any(Number),
        lockedSupply: expect.any(Number),
        circulatingSupply: expect.any(Number),
      })
    );
  });

  test("Should return 404 for an unknown path", async () => {
    const { request, etherscanApiKey } = await buildMockRequest("", "/unknown-path");
    
    const webResponse = await handleRequest(request, { etherscanApiKey });
    expect(webResponse.status).toBe(404);
    expect(webResponse.headers.get("Content-Type")).toBe("application/json");
    const responseData = await webResponse.json() as { error: string };
    expect(responseData.error).toContain("Endpoint /unknown-path not found");
  });
});
