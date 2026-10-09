import { expect, it } from "bun:test";

import { Effect } from "effect";

import { runEffectResult } from "../../src/server/core/action-result";
import {
  TaskPermissions,
  TaskPermissionsLive,
} from "../../src/server/tasks/permissions";

it("allows an employee to edit a task they created", async () => {
  const program = Effect.gen(function* program() {
    const permissions = yield* TaskPermissions;
    return yield* permissions.requireEdit(
      { id: "employee-1", isActive: true, role: "employee" },
      { assigneeIds: [], creatorId: "employee-1", isArchived: false }
    );
  });

  expect(
    await runEffectResult(
      Effect.provide(program, TaskPermissionsLive),
      "req-permission-creator"
    )
  ).toEqual({
    data: undefined,
    ok: true,
    requestId: "req-permission-creator",
  });
});

it("rejects an employee who neither created nor is assigned the task", async () => {
  const program = Effect.gen(function* program() {
    const permissions = yield* TaskPermissions;
    return yield* permissions.requireEdit(
      { id: "employee-1", isActive: true, role: "employee" },
      {
        assigneeIds: ["employee-3"],
        creatorId: "employee-2",
        isArchived: false,
      }
    );
  });

  expect(
    await runEffectResult(
      Effect.provide(program, TaskPermissionsLive),
      "req-permission-unassigned"
    )
  ).toEqual({
    error: {
      code: "FORBIDDEN",
      message: "You cannot edit this task.",
      requestId: "req-permission-unassigned",
    },
    ok: false,
  });
});
