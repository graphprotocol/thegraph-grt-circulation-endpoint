import { afterEach, beforeEach, expect, jest } from "@jest/globals";

let expectedRequests: Array<{ method: string; url: string }>;

beforeEach(() => {
  expectedRequests = [];
});

// Assert outside fetch so application error handling cannot swallow failures.
afterEach(() => {
  expectedRequests.forEach(({ method, url }, index) => {
    const call = jest.mocked(fetch).mock.calls[index];
    expect(call).toBeDefined();
    expect(String(call[0])).toBe(url);
    expect(call[1]?.method || 'GET').toBe(method);
  });
});

export function mockFetch(
  method: "GET" | "POST",
  url: string,
  body: Record<string, any>,
  status = 200
) {
  expectedRequests.push({ method, url });
  jest.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
  }));
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
