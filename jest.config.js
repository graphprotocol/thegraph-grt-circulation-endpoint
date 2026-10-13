module.exports = {
  testEnvironment: "miniflare",
  modulePathIgnorePatterns: ["/dist/"],
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
};
