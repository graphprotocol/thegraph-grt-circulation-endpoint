import { describe, expect, test, jest } from "@jest/globals";
import { mockFetch } from "./utils";
import { getBlockByTimestamp } from "../utils/blocks-info.graphql";

const MOCK_ETHERSCAN_API_KEY = "test-etherscan-key";
const ETHERSCAN_BASE_URL = "https://api.etherscan.io";

describe("getBlockByTimestamp (Etherscan with mocked HTTP responses)", () => {
  test("When Etherscan returns a valid block number -> should return Number", async () => {
    const timestamp = 1664630066;
    const expectedBlockNumber = 15653542;
    mockFetch("GET", ETHERSCAN_BASE_URL + `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`, {
        status: "1",
        message: "OK",
        result: {
          blockNumber: String(expectedBlockNumber),
        },
      }, 200);

    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).not.toBeNull();
    expect(result).toEqual(expectedBlockNumber);
  });

  test("When Etherscan returns status '0' (no block found) -> should return null", async () => {
    const timestamp = 121212121212121212;
    mockFetch("GET", ETHERSCAN_BASE_URL + `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`, {
        status: "0",
        message: "No closest block found",
        result: { // Etherscan often returns a result object even with status 0
          blockNumber: "0",
        },
      }, 200);

    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });
  
  test("When Etherscan returns blockNumber '0' -> should return null", async () => {
    const timestamp = 1438269988;
    mockFetch("GET", ETHERSCAN_BASE_URL + `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`, {
        status: "1",
        message: "OK",
        result: {
          blockNumber: "0",
        },
      }, 200);

    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });

  test("When Etherscan API returns a non-OK HTTP status -> should return null", async () => {
    const timestamp = 1;
    mockFetch("GET", ETHERSCAN_BASE_URL + `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`, { error: "Internal Server Error" }, 500);
    
    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });

  test("When Etherscan API returns OK HTTP but with an error message in body -> should return null", async () => {
    const timestamp = 1;
    mockFetch("GET", ETHERSCAN_BASE_URL + `/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${MOCK_ETHERSCAN_API_KEY}`, { // HTTP status is OK
        status: "0", // Etherscan specific error status
        message: "Error! Invalid API Key",
        result: null,
      }, 200);
    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });

  test("When fetch itself throws a network error (mocked) -> should return null", async () => {
    const timestamp = 1;
    jest.mocked(fetch).mockRejectedValueOnce(new Error("Network failure"));

    const result = await getBlockByTimestamp(timestamp, MOCK_ETHERSCAN_API_KEY);
    expect(result).toBeNull();
  });
});
