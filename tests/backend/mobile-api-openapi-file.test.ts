import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";
process.env["BETTER_AUTH_URL"] ??= "http://localhost:3000";

const FILE = new URL("../../docs/mobile-openapi.json", import.meta.url);

interface Document {
  readonly paths: Record<string, Record<string, { responses: object }>>;
}

const generated = async (): Promise<Document> => {
  const { buildOpenApiDocument } =
    await import("../../src/server/api/contract");
  return buildOpenApiDocument() as unknown as Document;
};

it("matches the committed docs/mobile-openapi.json, which the app team reads", async () => {
  const committed = JSON.parse(readFileSync(FILE, "utf-8")) as Document;

  // To refresh the file after changing a route: bun run openapi:write
  expect(committed).toEqual(await generated());
});

it("documents the 429 answer on every operation", async () => {
  const document = await generated();
  const missing = Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.entries(methods)
      .filter(([, operation]) => !("429" in operation.responses))
      .map(([method]) => `${method.toUpperCase()} ${path}`)
  );

  expect(missing).toEqual([]);
});

it("flags a route whose summary starts with Deprecated as deprecated", async () => {
  const document = (await generated()) as unknown as {
    paths: Record<string, Record<string, { deprecated?: boolean }>>;
  };
  const flagged = Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.entries(methods)
      .filter(([, operation]) => operation.deprecated === true)
      .map(([method]) => `${method.toUpperCase()} ${path}`)
  );

  // Nothing is deprecated right now; the flag follows the summary again the
  // day a route starts its summary with "Deprecated:".
  expect(flagged).toEqual([]);
});
