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
        exceptions: ["a", "b", "c", "g", "i", "j", "k", "m", "n", "r", "v", "x", "y", "z", "A", "G", "N", "T", "V", "_"],
        min: 2,
        properties: "never",
      },
    ],
  },
});
