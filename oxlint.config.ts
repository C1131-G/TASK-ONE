import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import next from "ultracite/oxlint/next";
import nextJsPlugins from "ultracite/oxlint/next/js-plugins";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";

const jsPlugins = selectJsPlugins(["react-doctor"]);

export default defineConfig({
  extends: [core, react, next, nextJsPlugins, shadcn, jsPlugins],
  ignorePatterns: [...(core.ignorePatterns ?? []), "components/ui/**"],
  jsPlugins: [...jsPlugins.jsPlugins, ...shadcn.jsPlugins],
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
  settings: jsPluginSettings,
});
