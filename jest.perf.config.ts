import { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageDirectory: "./coverage",
  collectCoverage: false,
  testMatch: ["**/src/**/?(*.)+(perf).[jt]s?(x)"],
  testPathIgnorePatterns: ["/lib/", "/node_modules/"],
  setupFilesAfterEnv: ["./jest.perf.setup.ts"],
};

export default config;
