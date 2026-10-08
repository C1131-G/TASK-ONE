import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

const tailwindSortConfig =
  typeof ultracite.sortTailwindcss === "object" &&
  ultracite.sortTailwindcss !== null
    ? ultracite.sortTailwindcss
    : {};

export default defineConfig({
  ...ultracite,
  // shadcn components are CLI-generated and should retain upstream formatting.
  ignorePatterns: [...(ultracite.ignorePatterns ?? []), "components/ui/**"],
  sortTailwindcss: {
    ...tailwindSortConfig,
    stylesheet: "./app/globals.css",
  },
});
