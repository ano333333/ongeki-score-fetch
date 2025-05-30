/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\.tsx?$": ["ts-jest",{}],
  },
  setupFiles: ["dotenv/config"],
  setupFilesAfterEnv: ["./tests/setup.ts"],
};