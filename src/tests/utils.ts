export function mockFetch(
  method: "GET" | "POST",
  url: string,
  body: Record<string, any>,
  status = 200
) {
  const fetchMock = getMiniflareFetchMock();
  fetchMock.disableNetConnect();
  const urlObj = new URL(url);
  const origin = fetchMock.get(urlObj.origin);
  origin
    .intercept({
      method,
      path: urlObj.pathname,
    })
    .reply(status, JSON.stringify(body));

  return fetchMock;
}

export function createMockRequest(url: string): any {
  const urlObj = new URL(url);
  return {
    headers: {
      host: urlObj.host,
    },
    originalUrl: urlObj.pathname + urlObj.search,
    url: urlObj.pathname + urlObj.search,
  };
}
