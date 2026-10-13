import { mock } from "bun:test";

// Query modules import "server-only", which Next.js resolves through its own
// bundler alias. Bun cannot resolve it, so tests stand in an empty module.
mock.module("server-only", () => ({}));
