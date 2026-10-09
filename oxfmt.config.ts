import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

const tailwindSortConfig =
  typeof ultracite.sortTailwindcss === "object" &&
  ultracite.sortTailwindcss !== null
    ? ultracite.sortTailwindcss
    : {};
const generatedAndVendorPaths = [
  ".agents/**",
  ".claude/**",
  ".cursor/**",
  ".devin/**",
  "migrations/**",
  "src/prisma/contract.d.ts",
  "src/prisma/contract.json",
  "src/prisma/migration.json",
  "src/prisma/ops.json",
];

export default defineConfig({
  ...ultracite,
  // shadcn components are CLI-generated and should retain upstream formatting.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "components/ui/**",
    ...generatedAndVendorPaths,
  ],
  sortTailwindcss: {
    ...tailwindSortConfig,
    stylesheet: "./app/globals.css",
  },
});
