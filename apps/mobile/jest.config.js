/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/components/**/*.test.tsx"],
  moduleNameMapper: {
    "^@api/(.*)$": "<rootDir>/../../src/mobile-api/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    // Files under ../../src/mobile-api transform to @babel/runtime requires,
    // but bun only links the runtime inside this workspace.
    "^@babel/runtime$": "<rootDir>/node_modules/@babel/runtime/index.js",
    "^@babel/runtime/(.*)$": "<rootDir>/node_modules/@babel/runtime/$1",
    "^react-native-svg$": "<rootDir>/tests/components/support/svg-mock.tsx",
    "^@react-native-community/datetimepicker$": "<rootDir>/tests/components/support/datetime-mock.tsx",
  },
  // Bun stores packages under node_modules/.bun/<name>@<version>+<hash>/,
  // so the preset's ignore patterns never match and React Native's ESM
  // setup files reach jest untransformed. Ignore everything outside the
  // .bun store and transform all workspace-installed packages inside it.
  transformIgnorePatterns: ["node_modules/(?!(?:\\.bun/[^/]+/node_modules/)?)"],
};
