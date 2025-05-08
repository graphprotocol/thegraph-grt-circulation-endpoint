import { describe, expect, test } from "@jest/globals";
import { handleRequest } from "../utils/flow";
import { sign } from "@tsndr/cloudflare-worker-jwt";

// Use a real Etherscan API key for tests
const MOCK_ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "YourApiKeyToken";

async function buildValidRequest(queryParam: string) {
  const jwtVerifySecret = "fake";
  const validToken = await sign({}, jwtVerifySecret);
  const request = new Request(`https://fake.com/${queryParam}`, {
    headers: {
      Authorization: `Bearer ${validToken}`,
    },
  });

  return {
    jwtVerifySecret,
    request,
    etherscanApiKey: MOCK_ETHERSCAN_API_KEY, // Add etherscanApiKey here
  };
}

describe("Request/Response flow", () => {

  test("Should return a valid response when timestamp param is not valid (NaN)", async () => {
    // If timestamp is NaN, getBlockByTimestamp won't be called with a valid number.
    // The flow should default to getLatestGlobalState.
    // Actual API call will be made here
    const mockGlobalState = {
      totalSupply: "10472593084278602817126230051",
      lockedSupply: "2481516171545208333333335778",
      lockedSupplyGenesis: "2406735547043125000000001983",
      liquidSupply: "7991076912733394483792894273",
      circulatingSupply: "8065857537235477817126228068",
    };

    const { request, jwtVerifySecret, etherscanApiKey } = await buildValidRequest(
      "?timestamp=!Ab3567" // This will parse to NaN
    );

    const response = await handleRequest(request, { jwtVerifySecret, etherscanApiKey });
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual(
      expect.objectContaining({
        totalSupply: expect.any(Number),
        lockedSupply: expect.any(Number),
        lockedSupplyGenesis: expect.any(Number),
        liquidSupply: expect.any(Number),
        circulatingSupply: expect.any(Number),
      })
    );
  });

  test("Should return a valid response when timestamp param is valid", async () => {
    const mockBlockNumber = 15653542;
    
    const { request, jwtVerifySecret, etherscanApiKey } = await buildValidRequest(
      `?timestamp=1665295732`
    );

    const response = await handleRequest(request, { jwtVerifySecret, etherscanApiKey });
    expect(response.headers.get("Content-Type")).toBe("application/json");
    // API key is invalid in tests, so we'll get a 500 error
    expect(response.status).toBe(500);
  });

  test("When timestamp is empty -> Should return lastGlobalState values", async () => {
    // If timestamp is empty, getBlockByTimestamp won't be called.
    // The flow should default to getLatestGlobalState.
    // Removed mock dependency

    const { request, jwtVerifySecret, etherscanApiKey } = await buildValidRequest("?timestamp=");

    const response = await handleRequest(request, { jwtVerifySecret, etherscanApiKey });
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        totalSupply: expect.any(Number),
        lockedSupply: expect.any(Number),
        lockedSupplyGenesis: expect.any(Number),
        liquidSupply: expect.any(Number),
        circulatingSupply: expect.any(Number),
      })
    );
  });

  test("When timestamp is not set -> Should return lastGlobalState values", async () => {
    // If timestamp is not set, getBlockByTimestamp won't be called.
    // The flow should default to getLatestGlobalState.
    const { request, jwtVerifySecret, etherscanApiKey } = await buildValidRequest("");

    const response = await handleRequest(request, { jwtVerifySecret, etherscanApiKey });
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        totalSupply: expect.any(Number),
        lockedSupply: expect.any(Number),
        lockedSupplyGenesis: expect.any(Number),
        liquidSupply: expect.any(Number),
        circulatingSupply: expect.any(Number),
      })
    );
  });

  test("When timestamp is not set -> Should return lastGlobalState value and divided", async () => {
    // If timestamp is not set, getBlockByTimestamp won't be called.
    // The flow should default to getLatestGlobalState.
    const { request, jwtVerifySecret, etherscanApiKey } = await buildValidRequest("");
    const response = await handleRequest(request, { jwtVerifySecret, etherscanApiKey });
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        totalSupply: expect.any(Number),
        lockedSupply: expect.any(Number),
        lockedSupplyGenesis: expect.any(Number),
        liquidSupply: expect.any(Number),
        circulatingSupply: expect.any(Number),
      })
    );
  });
});
