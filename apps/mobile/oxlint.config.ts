import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [],
  ignorePatterns: ["**/node_modules/**", ".expo/**", "android/**", "ios/**"],
  rules: {
    complexity: ["warn", { max: 20 }],
    "id-denylist": [
      "warn",
      "temp",
      "tmp",
      "foo",
      "bar",
      "baz",
      "val",
      "obj",
      "res",
      "callback",
      "cb",
    ],
    "id-length": [
      "warn",
      {
        exceptions: ["i", "j", "k", "x", "y", "z", "_"],
        min: 2,
        properties: "never",
      },
    ],
  },
});
