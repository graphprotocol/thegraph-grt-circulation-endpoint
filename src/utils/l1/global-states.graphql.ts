import {
  AllGlobalStatesQuery,
  AllGlobalStatesQueryVariables,
} from "../../types/global-states.graphql";
import { fetchGraphQL } from "../fetch-graphql";

const allGlobalStates = /* GraphQL */ `
  query allGlobalStates(
    $blockFilter: Block_height
    $orderDirection: OrderDirection
  ) {
    globalStates(block: $blockFilter, orderDirection: $orderDirection) {
      totalSupply
      lockedSupply
      lockedSupplyGenesis
      liquidSupply
      circulatingSupply
    }
  }
`;

export async function getGlobalStateByBlockNumber(blockNumber: number | null) {
  const globalStateResponse = await fetchGraphQL<
    AllGlobalStatesQueryVariables,
    AllGlobalStatesQuery
  >({
    url: "https://gateway.thegraph.com/api/subgraphs/id/6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY",
    query: allGlobalStates,
    variables: {
      blockFilter: {
        number: blockNumber,
      },
    },
  });

  if (!globalStateResponse) {
    console.error(`${globalStateResponse}`);
    throw new Error("Failed to fetch global state");
  }
  if (globalStateResponse.globalStates.length > 1) {
    console.error(`${globalStateResponse}`);
    throw new Error("globalStates.length > 1");
  }

  return globalStateResponse ? globalStateResponse.globalStates[0] : null;
}

export async function getLatestGlobalState() {
  const globalStateResponse = await fetchGraphQL<
    AllGlobalStatesQueryVariables,
    AllGlobalStatesQuery
  >({
    url: "https://gateway.thegraph.com/api/subgraphs/id/6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY",
    query: allGlobalStates,
    variables: {
      orderDirection: "desc",
    },
  });

  if (!globalStateResponse) {
    console.error(`${globalStateResponse}`);
    throw new Error("Failed to fetch latest global state");
  }

  return globalStateResponse.globalStates[0];
}
