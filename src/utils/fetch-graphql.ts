import { ExecutionResult } from "graphql";

export async function fetchGraphQL<TVariables, TResponse>(input: {
  url: string;
  query: string;
  variables: TVariables;
}): Promise<TResponse> {
  const headers: HeadersInit = {
    accept: "*/*",
    "content-type": "application/json",
  };

  if (input.url.startsWith("https://gateway.thegraph.com/api/subgraphs/id/")) {
    headers["Authorization"] = "Bearer a3c6ac399250b5612c70354edda5c458";
  }

  const response = await fetch(input.url, {
    headers,
    body: JSON.stringify({
      query: input.query,
      variables: input.variables,
    }),
    method: "POST",
  });

  if (response.status !== 200) {
    throw new Error(`Invalid GraphQL status code: ${response.status}`);
  }

  const body = (await response.json()) as ExecutionResult<TResponse>;

  if (body.errors && body.errors.length > 0) {
    console.log(`${body.errors}`);
    throw new Error(
      `GraphQL Errors: ${body.errors.map((e: any) => e.message).join(",")}`
    );
  }

  if (!body.data) {
    console.log(`${body.data}`);
    throw new Error(`GraphQL Error: unexpected empty response`);
  }

  return body.data!;
}
