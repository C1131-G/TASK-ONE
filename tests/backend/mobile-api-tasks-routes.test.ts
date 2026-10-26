import { expect, it } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { taskRoutes } from "../../src/mobile-api/routes-tasks";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";
process.env["BETTER_AUTH_URL"] ??= "http://localhost:3000";

const appRoot = fileURLToPath(new URL("../../app", import.meta.url));
const BRACED = /\{[^}]+\}/gu;

const braced = (route: string): string[] =>
  (route.match(BRACED) ?? []).map((token) => token.slice(1, -1));

it("names every task route parameter the way its route folder does", () => {
  for (const route of taskRoutes) {
    const folder = route.path.replaceAll(
      BRACED,
      (token) => `[${token.slice(1, -1)}]`
    );
    expect(existsSync(path.join(appRoot, folder, "route.ts"))).toBe(true);
    const declared =
      "params" in route ? Object.keys(route.params.fields).toSorted() : [];
    expect(declared).toEqual(braced(route.path).toSorted());
  }
});

it("publishes the task routes in the OpenAPI document with the folder parameter names", async () => {
  const { GET } = await import("../../app/api/v1/openapi.json/route");
  const response = await GET();
  const spec = (await response.json()) as {
    readonly paths: Record<
      string,
      Record<
        string,
        {
          readonly parameters?: readonly {
            readonly in: string;
            readonly name: string;
          }[];
        }
      >
    >;
  };

  const operation =
    spec.paths[
      "/api/v1/workspace/tasks/{taskId}/subtasks/{subtaskId}/status"
    ]?.["post"];
  expect(
    operation?.parameters
      ?.filter(({ in: location }) => location === "path")
      .map(({ name }) => name)
      .toSorted()
  ).toEqual(["subtaskId", "taskId"]);
  expect(
    spec.paths["/api/v1/workspace/tasks/{id}/subtasks/{subtaskId}/status"]
  ).toBeUndefined();
});
