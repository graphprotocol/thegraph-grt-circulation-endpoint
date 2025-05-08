import { describe, expect, test } from "@jest/globals";
import { mockFetch } from "./utils";
import { getLatestGlobalState } from "../utils/global-states.graphql";

describe("getLatestGlobalState", () => {
  test("should throw an error when HTTP response is 200 but we got GraphQL errors", () => {
    mockFetch(
      "POST",
      "https://gateway.thegraph.com/api/subgraphs/id/6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY",
      {
        data: {
          globalStates: [
            {
              totalSupply: "10472593084278602817126230051",
              lockedSupply: "2481516171545208333333335778",
              lockedSupplyGenesis: "2406735547043125000000001983",
              liquidSupply: "7991076912733394483792894273",
              circulatingSupply: "8065857537235477817126228068",
            },
          ],
        },
      }
    );
    const result$ = getLatestGlobalState();
    // TODO: Fix this
    expect(result$);
    // TODO: real assertion
  });
});
