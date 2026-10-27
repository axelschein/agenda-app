/** Source-based ESM tests; never read dist or run the production build. */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/unit/**/*.spec.ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { useESM: true, tsconfig: "<rootDir>/tsconfig.test.json" },
    ],
  },
  moduleNameMapper: {
    "^@agenda-app/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  clearMocks: true,
  restoreMocks: true,
};
