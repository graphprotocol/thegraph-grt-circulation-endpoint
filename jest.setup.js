// Tests must supply their own HTTP responses and never call live APIs.
let unexpectedRequests;

beforeEach(() => {
  unexpectedRequests = [];
  globalThis.fetch = jest.fn((input) => {
    unexpectedRequests.push(String(input));
    return Promise.reject(new Error('Unexpected HTTP request: add a fetch mock'));
  });
});

afterEach(() => {
  expect(unexpectedRequests).toEqual([]);
});
