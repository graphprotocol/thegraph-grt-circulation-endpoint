import { L2SupplyData, L2GraphQLResponse } from "./types";
import { fetchGraphQL } from "../fetch-graphql";
import { Decimal } from "decimal.js";

// L2 GraphQL query for Graph Network data
const l2GraphNetworkQuery = /* GraphQL */ `
  query l2GraphNetworks($blockFilter: Block_height) {
    graphNetworks(first: 1, block: $blockFilter) {
      totalSupply
      totalGRTDepositedConfirmed
      totalGRTWithdrawn
    }
  }
`;

function transformL2Response(graphNetwork: { totalSupply: string; totalGRTDepositedConfirmed: string; totalGRTWithdrawn: string }): L2SupplyData {
  const totalSupply = graphNetwork.totalSupply;
  const totalGRTDepositedConfirmed = graphNetwork.totalGRTDepositedConfirmed;
  const totalGRTWithdrawn = graphNetwork.totalGRTWithdrawn;
  
  // Calculate net L2 supply (new tokens minted on L2)
  // netL2Supply = totalSupply - (deposited - withdrawn)
  // This accounts for the net bridge flow: deposits reduce L2 net supply, withdrawals increase it
  const netL2Supply = new Decimal(totalSupply)
    .minus(new Decimal(totalGRTDepositedConfirmed))
    .plus(new Decimal(totalGRTWithdrawn))
    .toString();

  return {
    totalSupply,
    totalGRTDepositedConfirmed,
    totalGRTWithdrawn,
    netL2Supply,
  };
}

export async function getL2SupplyByBlockNumber(
  blockNumber: number | null,
  l2SubgraphUrl: string
): Promise<L2SupplyData | null> {
  try {
    console.log(`Fetching L2 supply data for block ${blockNumber || 'latest'}`);
    
    const l2Response = await fetchGraphQL<{ blockFilter?: { number: number } }, L2GraphQLResponse>({
      url: l2SubgraphUrl,
      query: l2GraphNetworkQuery,
      variables: blockNumber ? { blockFilter: { number: blockNumber } } : {},
    });

    if (!l2Response || !l2Response.graphNetworks || l2Response.graphNetworks.length === 0) {
      console.error("No L2 GraphNetwork data found");
      return null;
    }

    const graphNetwork = l2Response.graphNetworks[0];
    console.log(`L2 data fetched: totalSupply=${graphNetwork.totalSupply}, deposited=${graphNetwork.totalGRTDepositedConfirmed}, withdrawn=${graphNetwork.totalGRTWithdrawn}`);
    
    return transformL2Response(graphNetwork);
  } catch (error) {
    console.error("Failed to fetch L2 supply data by block:", error);
    throw new Error(`Failed to fetch L2 supply data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getLatestL2Supply(l2SubgraphUrl: string): Promise<L2SupplyData> {
  try {
    console.log("Fetching latest L2 supply data");
    
    const l2Response = await fetchGraphQL<{}, L2GraphQLResponse>({
      url: l2SubgraphUrl,
      query: l2GraphNetworkQuery,
      variables: {},
    });

    if (!l2Response || !l2Response.graphNetworks || l2Response.graphNetworks.length === 0) {
      console.error("No L2 GraphNetwork data found");
      throw new Error("No L2 GraphNetwork data found");
    }

    const graphNetwork = l2Response.graphNetworks[0];
    console.log(`Latest L2 data: totalSupply=${graphNetwork.totalSupply}, deposited=${graphNetwork.totalGRTDepositedConfirmed}, withdrawn=${graphNetwork.totalGRTWithdrawn}`);
    
    return transformL2Response(graphNetwork);
  } catch (error) {
    console.error("Failed to fetch latest L2 supply data:", error);
    throw new Error(`Failed to fetch latest L2 supply data: ${error instanceof Error ? error.message : String(error)}`);
  }
}