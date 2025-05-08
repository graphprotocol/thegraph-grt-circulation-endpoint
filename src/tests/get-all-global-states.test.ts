import { describe, expect, test } from "@jest/globals";
import { mockFetch } from "./utils";
import { getGlobalStateByBlockNumber } from "../utils/global-states.graphql";

describe("getAllGlobalStates", () => {
  test("When we got valid timestamp -> we should return Number", async () => {
    mockFetch(
      "POST",
      "https://gateway.thegraph.com/api/subgraphs/id/6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY",
      {
        data: {
          globalStates: [
            {
              totalSupply: "10472555636557181479854142240",
              lockedSupply: "2477839088211875000000002459",
              lockedSupplyGenesis: "2403173047043125000000001990",
              liquidSupply: "7994716548345306479854139781",
              circulatingSupply: "8069382589514056479854140250",
            },
          ],
        },
      },
      200
    );
    const result = await getGlobalStateByBlockNumber(15653542);
    expect(result).not.toBeNull();
    expect(await result).toEqual(
      expect.objectContaining({
        totalSupply: "10472555636557181479854142240",
        lockedSupply: "2477839088211875000000002459",
        lockedSupplyGenesis: "2403173047043125000000001990",
        liquidSupply: "7994716548345306479854139781",
        circulatingSupply: "8069382589514056479854140250",
      })
    );
  });

  test("should throw error when we got HTTP 300/400/500", async () => {
    mockFetch(
      "POST",
      "https://gateway.thegraph.com/api/subgraphs/id/6FzQRX4QRVUcAKp6K1DjwnvuQwSYfwhdVG2EhVmHrUwY",
      {
        errors: [
          {
            message:
              "Failed to decode `BigInt` value: `cannot parse integer from empty string`",
          },
        ],
      },
      500
    );
    const result$ = getGlobalStateByBlockNumber(1);
    await expect(result$).rejects.toEqual(
      new Error("Invalid GraphQL status code: 500")
    );
  });
});
