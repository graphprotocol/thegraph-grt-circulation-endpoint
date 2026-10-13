import { describe, expect, test, jest } from "@jest/globals";
import { mockFetch } from "./utils";
import { getLatestBlock } from "../utils/blocks-info.graphql";

const MOCK_ETHERSCAN_API_KEY = "test-etherscan-key";
const ETHERSCAN_BASE_URL = "https://api.etherscan.io";

describe("getLatestBlock (Etherscan with mocked HTTP responses)", () => {
  test("When Etherscan returns a valid hex block number -> should return Number", async () => {
    mockFetch("GET", ETHERSCAN_BASE_URL + `/api?module=proxy&action=eth_blockNumber&apikey=${MOCK_ETHERSCAN_API_KEY}`, {
        result: "0xf42401", // Example: 16000001
      }, 200);

    const result = await getLatestBlock(MOCK_ETHERSCAN_API_KEY);
    expect(result).not.toBeNull();
    expect(result).toEqual(16000001);
  });

  test("When Etherscan API returns a non-OK HTTP status -> should throw error", async () => {
    mockFetch("GET", ETHERSCAN_BASE_URL + `/api?module=proxy&action=eth_blockNumber&apikey=${MOCK_ETHERSCAN_API_KEY}`, { error: "Internal Server Error" }, 500);

    await expect(getLatestBlock(MOCK_ETHERSCAN_API_KEY)).rejects.toThrow(
      "Etherscan API error for getLatestBlock: 500"
    );
  });

  test("When Etherscan API returns OK HTTP but with an error message (e.g., rate limit) -> should throw error", async () => {
    mockFetch("GET", ETHERSCAN_BASE_URL + `/api?module=proxy&action=eth_blockNumber&apikey=${MOCK_ETHERSCAN_API_KEY}`, { // HTTP status is OK
        message: "NOTOK",
        result: "Max rate limit reached",
      }, 200);

    await expect(getLatestBlock(MOCK_ETHERSCAN_API_KEY)).rejects.toThrow(
      "Etherscan API rate limit reached for getLatestBlock."
    );
  });
  
  test("When Etherscan API returns OK HTTP but with an unexpected non-hex result -> should throw error", async () => {
    mockFetch("GET", ETHERSCAN_BASE_URL + `/api?module=proxy&action=eth_blockNumber&apikey=${MOCK_ETHERSCAN_API_KEY}`, {
        result: "ThisIsNotHex",
      }, 200);

    await expect(getLatestBlock(MOCK_ETHERSCAN_API_KEY)).rejects.toThrow(
      "Failed to parse latest block from Etherscan response"
    );
  });

  test("When fetch itself throws a network error (mocked) -> should throw error", async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new Error("Network failure"));

    await expect(getLatestBlock(MOCK_ETHERSCAN_API_KEY)).rejects.toThrow(
      "Network failure"
    );
  });
});
