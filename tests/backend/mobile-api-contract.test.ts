import { expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";
process.env["BETTER_AUTH_URL"] ??= "http://localhost:3000";

const apiRoot = fileURLToPath(new URL("../../app/api/v1", import.meta.url));
const SPEC_ROUTE = "openapi.json";

// "me/route.ts" becomes "/api/v1/me"; "tasks/[id]/route.ts" becomes
// "/api/v1/tasks/{id}".
const routeFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return routeFiles(full);
    }
    return entry.name === "route.ts" ? [full] : [];
  });

const publishedPaths = (): string[] =>
  routeFiles(apiRoot)
    .map((file) =>
      path
        .relative(apiRoot, path.dirname(file))
        .split(path.sep)
        .map((part) => part.replace(/^\[(?<name>.+)\]$/u, "{$<name>}"))
        .join("/")
    )
    .filter((route) => route !== SPEC_ROUTE)
    .map((route) => `/api/v1/${route}`)
    .toSorted();

const loadSpec = async (): Promise<{
  readonly info: { readonly title: string };
  readonly openapi: string;
  readonly paths: Record<string, Record<string, Record<string, unknown>>>;
}> => {
  const { GET } = await import("../../app/api/v1/openapi.json/route");
  const response = await GET();
  expect(response.status).toBe(200);
  return (await response.json()) as Awaited<ReturnType<typeof loadSpec>>;
};

it("publishes an OpenAPI document for the mobile API", async () => {
  const spec = await loadSpec();

  expect(spec.openapi).toBe("3.1.0");
  expect(spec.info.title).toBe("Metsys mobile API");
});

it("describes /api/v1/me with bearer security and its response shape", async () => {
  const spec = await loadSpec();
  const operation = spec.paths["/api/v1/me"]?.["get"];

  expect(operation).toMatchObject({
    operationId: "getMe",
    security: [{ bearerAuth: [] }],
  });
  expect(JSON.stringify(operation)).toContain("clientCompanyId");
});

it("documents every route file and has no definition without a route", async () => {
  const spec = await loadSpec();

  expect(Object.keys(spec.paths).toSorted()).toEqual(publishedPaths());
});
