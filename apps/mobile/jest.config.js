/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/components/**/*.test.tsx"],
  moduleNameMapper: {
    "^@api/(.*)$": "<rootDir>/../../src/mobile-api/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Bun stores packages under node_modules/.bun/<name>@<version>+<hash>/,
  // so the preset's ignore patterns never match and React Native's ESM
  // setup files reach jest untransformed. Ignore everything except the
  // React Native and Expo families, whether hoisted or nested in .bun.
  // The alternation covers the nested .bun path and the bare package path
  // because jest tests the pattern at every "node_modules" position.
  transformIgnorePatterns: [
    "node_modules/(?!(?:\\.bun/[^/]+/node_modules/)?@?(?:react-native|expo|testing-library))",
  ],
};
