import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { authPool, personaId } from "./support/action-harness";
import {
  installHooks,
  pick,
  state,
  submit,
} from "./support/client-lifecycle-fixtures";
import { seedSubtask, seedTask } from "./support/mobile-tasks-fixtures";

installHooks();

const rejection = async (run: Promise<unknown>): Promise<string> => {
  try {
    await run;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
};

// The application keeps these pairs in step; the database now refuses a row
// that breaks them, so a bug elsewhere cannot leave half a state behind.
it("refuses a task that is archived without saying who archived it, or the reverse", async () => {
  const taskId = await seedTask();

  const onlyTime = await rejection(
    authPool.query('UPDATE task SET "archivedAt" = now() WHERE id = $1', [
      taskId,
    ])
  );
  const onlyPerson = await rejection(
    authPool.query('UPDATE task SET "archivedById" = $2 WHERE id = $1', [
      taskId,
      personaId("admin"),
    ])
  );
  const both = await rejection(
    authPool.query(
      'UPDATE task SET "archivedAt" = now(), "archivedById" = $2 WHERE id = $1',
      [taskId, personaId("admin")]
    )
  );

  expect(onlyTime).toContain("task_archive_pair");
  expect(onlyPerson).toContain("task_archive_pair");
  expect(both).toBe("");
});

it("refuses a subtask whose completed flag disagrees with its completion time", async () => {
  const taskId = await seedTask();
  const subtaskId = await seedSubtask(taskId, "Pair", 0);

  const flagOnly = await rejection(
    authPool.query(
      'UPDATE task_subtask SET "isCompleted" = true WHERE id = $1',
      [subtaskId]
    )
  );
  const timeOnly = await rejection(
    authPool.query(
      'UPDATE task_subtask SET "completedAt" = now() WHERE id = $1',
      [subtaskId]
    )
  );
  const both = await rejection(
    authPool.query(
      'UPDATE task_subtask SET "isCompleted" = true, "completedAt" = now() WHERE id = $1',
      [subtaskId]
    )
  );

  expect(flagOnly).toContain("task_subtask_completion_pair");
  expect(timeOnly).toContain("task_subtask_completion_pair");
  expect(both).toBe("");
});

it("refuses a fix attempt with a partly recorded verification", async () => {
  const bugId = await submit("Verification pair");
  await pick(bugId);
  const attemptId = randomUUID();
  const { pickedById } = await state(bugId);
  await authPool.query(
    'INSERT INTO bug_fix_attempt (id, "bugReportId", "authorId", "rootCause", "fixSummary", "verificationSteps") VALUES ($1, $2, $3, \'Cause\', \'Fix\', ARRAY[\'Retest\'])',
    [attemptId, bugId, pickedById]
  );

  const outcomeOnly = await rejection(
    authPool.query(
      "UPDATE bug_fix_attempt SET \"verificationOutcome\" = 'passed' WHERE id = $1",
      [attemptId]
    )
  );
  const complete = await rejection(
    authPool.query(
      'UPDATE bug_fix_attempt SET "verificationOutcome" = \'passed\', "verifiedById" = $2, "verifiedAt" = now() WHERE id = $1',
      [attemptId, pickedById]
    )
  );

  expect(outcomeOnly).toContain("bug_fix_attempt_verification_complete");
  expect(complete).toBe("");
});
