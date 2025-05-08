import { describe, expect, test, beforeEach, afterEach } from "@jest/globals";
import { MockAgent, setGlobalDispatcher, Interceptable } from "undici";
import { getBlockByTimestamp } from "../utils/blocks-info.graphql";

// Use a real Etherscan API key for tests
const MOCK_ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "YourApiKeyToken";
const ETHERSCAN_BASE_URL = "https://api.etherscan.io";

describe("getBlockByTimestamp (Etherscan with Undici MockAgent)", () => {
  let mockAgent: MockAgent;
  let mockEtherscanClient: Interceptable;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect(); // Ensure no real network calls are made
    setGlobalDispatcher(mockAgent);
    mockEtherscanClient = mockAgent.get(ETHERSCAN_BASE_URL);
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  test("When Etherscan returns a valid block number -> should return Number", async () => {
    const timestamp = 1664630066;
    const expectedBlockNumber = 15653542;
    mockEtherscanClient
      .intercept({
        path: `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .reply(200, {
        status: "1",
        message: "OK",
        result: {
          blockNumber: String(expectedBlockNumber),
        },
      });

    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).not.toBeNull();
    expect(result).toEqual(expectedBlockNumber);
  });

  test("When Etherscan returns status '0' (no block found) -> should return null", async () => {
    const timestamp = 121212121212121212;
    mockEtherscanClient
      .intercept({
        path: `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .reply(200, {
        status: "0",
        message: "No closest block found",
        result: { // Etherscan often returns a result object even with status 0
          blockNumber: "0",
        },
      });

    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });
  
  test("When Etherscan returns blockNumber '0' -> should return null", async () => {
    const timestamp = 1438269988;
    mockEtherscanClient
      .intercept({
        path: `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .reply(200, {
        status: "1",
        message: "OK",
        result: {
          blockNumber: "0",
        },
      });

    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });

  test("When Etherscan API returns a non-OK HTTP status -> should return null", async () => {
    const timestamp = 1;
    mockEtherscanClient
      .intercept({
        path: `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .reply(500, { error: "Internal Server Error" });
    
    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });

  test("When Etherscan API returns OK HTTP but with an error message in body -> should return null", async () => {
    const timestamp = 1;
    mockEtherscanClient
      .intercept({
        path: `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .reply(200, { // HTTP status is OK
        status: "0", // Etherscan specific error status
        message: "Error! Invalid API Key",
        result: null,
      });
    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });

  test("When fetch itself throws a network error (simulated by undici) -> should return null", async () => {
    const timestamp = 1;
    mockEtherscanClient
      .intercept({
        path: `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .replyWithError(new Error("Network failure"));

    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });
});
