import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { mobileRoutes } from "../../src/mobile-api/routes";

const PUBLIC_ROUTES = new Set(["GET /api/v1/openapi.json"]);

const docText = readFileSync(
  new URL("../../docs/mobile-api.md", import.meta.url),
  "utf-8"
);

// A table row looks like: | `GET` | `/api/v1/me` | who | purpose |
const documentedRoutes = (): string[] =>
  docText
    .split("\n")
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter(
      (cells) =>
        cells.length > 3 &&
        ["GET", "POST", "PATCH", "DELETE"].includes(
          cells[1]?.replaceAll("`", "") ?? ""
        ) &&
        (cells[2]?.startsWith("`/api/v1/") ?? false)
    )
    .map(
      (cells) =>
        `${cells[1]?.replaceAll("`", "")} ${cells[2]?.replaceAll("`", "")}`
    );

it("documents every mobile route in docs/mobile-api.md", () => {
  const documented = new Set(documentedRoutes());
  const missing = mobileRoutes
    .map((route) => `${route.method.toUpperCase()} ${route.path}`)
    .filter((route) => !documented.has(route));

  expect(missing).toEqual([]);
});

it("documents no route that does not exist", () => {
  const known = new Set([
    ...PUBLIC_ROUTES,
    ...mobileRoutes.map(
      (route) => `${route.method.toUpperCase()} ${route.path}`
    ),
  ]);
  const unknown = documentedRoutes().filter((route) => !known.has(route));

  expect(unknown).toEqual([]);
});

it("lists each route once", () => {
  const rows = documentedRoutes();

  expect(rows.length).toBe(new Set(rows).size);
});
