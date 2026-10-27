import { afterAll, beforeAll, expect, it } from "bun:test";

import { Effect, Layer } from "effect";

import { ActivityManagementLive } from "../../src/server/activity/activity-management";
import {
  Collaboration,
  CollaborationLive,
} from "../../src/server/collaboration/service";
import { runEffectResult } from "../../src/server/core/action-result";
import { BugHistory, BugHistoryLive } from "../../src/server/work/bug-history";
import {
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { seedClientBug, seedTask } from "./support/mobile-tasks-fixtures";

beforeAll(setupHarness);
afterAll(teardownHarness);

const readBug = (actorId: string, bugId: string) =>
  runEffectResult(
    Effect.provide(
      Effect.gen(function* read() {
        const history = yield* BugHistory;
        return yield* history.get(actorId, bugId);
      }),
      BugHistoryLive
    ),
    "req-bug-history-guard"
  );

const readComments = (actorId: string, taskId: string) =>
  runEffectResult(
    Effect.provide(
      Effect.gen(function* read() {
        const collaboration = yield* Collaboration;
        return yield* collaboration.listComments(actorId, taskId);
      }),
      Layer.mergeAll(CollaborationLive, ActivityManagementLive)
    ),
    "req-comments-guard"
  );

const seedBug = async () => {
  const taskId = await seedTask({ type: "bug" });
  const bugId = await seedClientBug(taskId, ids.clientCompanyId);
  return { bugId, taskId };
};

it("refuses a client account when the bug history is read", async () => {
  const { bugId } = await seedBug();

  const result = await readBug(personaId("client"), bugId);

  expect(result).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});

it("still shows the bug history to staff", async () => {
  const { bugId } = await seedBug();

  const result = await readBug(personaId("admin"), bugId);

  expect(result.ok).toBe(true);
});

it("refuses a client account when a task's comments are listed", async () => {
  const { taskId } = await seedBug();

  const result = await readComments(personaId("client"), taskId);

  expect(result).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});

it("still lists a task's comments for staff", async () => {
  const { taskId } = await seedBug();

  const result = await readComments(personaId("owner"), taskId);

  expect(result.ok).toBe(true);
});
