module.exports = {
  testEnvironment: "miniflare",
  modulePathIgnorePatterns: ["/dist/"],
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['dotenv/config'],
};
