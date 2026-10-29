import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { parseDeepLink } from "@/features/navigation/deep-links";

describe("deep link parsing", () => {
  it("decodes a plain app path", async () => {
    const link = await Effect.runPromise(parseDeepLink("taskora://my-tasks"));

    expect(link.path).toBe("/my-tasks");
    expect(link.id).toBeUndefined();
  });

  it("decodes a path with an id parameter", async () => {
    const link = await Effect.runPromise(parseDeepLink("taskora://projects?id=proj-9"));

    expect(link.path).toBe("/projects");
    expect(link.id).toBe("proj-9");
  });

  it("fails NotFound for an unknown path", async () => {
    const exit = await Effect.runPromiseExit(parseDeepLink("taskora://unknown-place"));

    expect(exit._tag).toBe("Failure");
  });

  it("fails NotFound for a malformed URL", async () => {
    const exit = await Effect.runPromiseExit(parseDeepLink("not a url"));

    expect(exit._tag).toBe("Failure");
  });
});
