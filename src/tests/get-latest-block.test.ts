import { describe, expect, test, beforeEach, afterEach } from "@jest/globals";
import { MockAgent, setGlobalDispatcher, Interceptable } from "undici";
import { getLatestBlock } from "../utils/blocks-info.graphql";

// Use a real Etherscan API key for tests
const MOCK_ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "YourApiKeyToken";
const ETHERSCAN_BASE_URL = "https://api.etherscan.io";

describe("getLatestBlock (Etherscan with Undici MockAgent)", () => {
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

  test("When Etherscan returns a valid hex block number -> should return Number", async () => {
    mockEtherscanClient
      .intercept({
        path: `/api?module=proxy&action=eth_blockNumber&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .reply(200, {
        result: "0xf42401", // Example: 16000001
      });

    const result = await getLatestBlock(MOCK_ETHERSCAN_API_KEY);
    expect(result).not.toBeNull();
    expect(result).toEqual(16000001);
  });

  test("When Etherscan API returns a non-OK HTTP status -> should throw error", async () => {
    mockEtherscanClient
      .intercept({
        path: `/api?module=proxy&action=eth_blockNumber&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .reply(500, { error: "Internal Server Error" });

    await expect(getLatestBlock(MOCK_ETHERSCAN_API_KEY)).rejects.toThrow(
      "Etherscan API error for getLatestBlock: 500"
    );
  });

  test("When Etherscan API returns OK HTTP but with an error message (e.g., rate limit) -> should throw error", async () => {
    mockEtherscanClient
      .intercept({
        path: `/api?module=proxy&action=eth_blockNumber&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .reply(200, { // HTTP status is OK
        message: "NOTOK",
        result: "Max rate limit reached",
      });

    await expect(getLatestBlock(MOCK_ETHERSCAN_API_KEY)).rejects.toThrow(
      "Etherscan API rate limit reached for getLatestBlock."
    );
  });
  
  test("When Etherscan API returns OK HTTP but with an unexpected non-hex result -> should throw error", async () => {
    mockEtherscanClient
      .intercept({
        path: `/api?module=proxy&action=eth_blockNumber&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .reply(200, {
        result: "ThisIsNotHex",
      });

    await expect(getLatestBlock(MOCK_ETHERSCAN_API_KEY)).rejects.toThrow(
      "Failed to parse latest block from Etherscan response"
    );
  });

  test("When fetch itself throws a network error (simulated by undici) -> should throw error", async () => {
    mockEtherscanClient
      .intercept({
        path: `/api?module=proxy&action=eth_blockNumber&apikey=${MOCK_ETHERSCAN_API_KEY}`,
        method: "GET",
      })
      .replyWithError(new Error("Network failure"));

    await expect(getLatestBlock(MOCK_ETHERSCAN_API_KEY)).rejects.toThrow(
      "Network failure"
    );
  });
});
