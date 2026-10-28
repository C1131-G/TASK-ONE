import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const mobileRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    // Keep one effect instance across tests and services; bun's nested
    // install would otherwise resolve two copies and effects stop being
    // runnable across module boundaries.
    dedupe: ["effect", "@tanstack/react-query", "@tanstack/react-store"],
    alias: {
      "@api": `${mobileRoot}../../src/mobile-api`,
      "@pending": `${mobileRoot}src/api/pending-routes`,
      "@": `${mobileRoot}src`,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The no-try-catch guard reads every source file; a loaded machine needs more than 5 s.
    testTimeout: 30_000,
  },
});
