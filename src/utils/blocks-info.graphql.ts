type BlockNumber = number;

interface EtherscanBlockByTimeResponse {
  status: string;
  message: string;
  result: {
    blockNumber: string;
  };
}

interface EtherscanLatestBlockResponse {
  status: string;
  message: string;
  result: string; // Hex string for block number
}

export async function getBlockByTimestamp(
  timestamp: number,
  etherscanApiKey: string
): Promise<BlockNumber | null> {
  const url = `https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${etherscanApiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Etherscan API error for getBlockByTimestamp: ${response.status} ${response.statusText}`);
      // Consider throwing a more specific error or returning a specific error indicator
      return null;
    }

    const data = (await response.json()) as EtherscanBlockByTimeResponse;

    if (data.status === "1" && data.result && data.result.blockNumber) {
      const blockNumber = parseInt(data.result.blockNumber, 10);
      // Etherscan might return '0' if no block found before timestamp, treat as null or handle as per requirements
      return blockNumber === 0 ? null : blockNumber;
    } else {
      console.error(`Etherscan API error for getBlockByTimestamp: ${data.message}`, data);
      return null;
    }
  } catch (error) {
    console.error("Failed to fetch block by timestamp from Etherscan:", error);
    return null;
  }
}

export async function getLatestBlock(
  etherscanApiKey: string
): Promise<BlockNumber> {
  const url = `https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=${etherscanApiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Etherscan API error for getLatestBlock: ${response.status} ${response.statusText}`);
      // Consider how to handle this - perhaps throw an error to halt processing if latest block is critical
      throw new Error(`Etherscan API error for getLatestBlock: ${response.status}`);
    }

    const data = (await response.json()) as EtherscanLatestBlockResponse;

    // Etherscan's eth_blockNumber returns status "1" for success, but the actual block number is in result.
    // It doesn't follow the same status/message/result structure for this specific proxy action as others.
    // A successful response directly contains the hex block number in `data.result`.
    // A typical error response might look like: { "jsonrpc": "2.0", "id": 1, "error": { "code": -32000, "message": "missing apikey" } }
    // Or for rate limits: { "message": "NOTOK", "result":"Max rate limit reached" }
    if (data.result && typeof data.result === 'string' && data.result.startsWith('0x')) {
      return parseInt(data.result, 16);
    } else if (data.message === "NOTOK" && typeof data.result === 'string' && data.result.includes("Max rate limit reached")) {
      console.error("Etherscan API rate limit reached for getLatestBlock.");
      throw new Error("Etherscan API rate limit reached for getLatestBlock.");
    }
    else {
      console.error("Failed to parse latest block from Etherscan response:", data);
      throw new Error("Failed to parse latest block from Etherscan response");
    }
  } catch (error) {
    console.error("Failed to fetch latest block from Etherscan:", error);
    throw error; // Re-throw to allow upstream handling
  }
}
