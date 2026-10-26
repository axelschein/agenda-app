const base = require("./jest.config.cjs");
module.exports = {
  ...base,
  testMatch: ["<rootDir>/test/integration/**/*.spec.ts"],
};
