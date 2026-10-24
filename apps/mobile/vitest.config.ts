import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const mobileRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@api": `${mobileRoot}../../src/mobile-api`,
      "@": `${mobileRoot}src`,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
