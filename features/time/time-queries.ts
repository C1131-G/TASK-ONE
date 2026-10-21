import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import type { AppError } from "@/src/server/core/action-result";
import {
  CalendarDateSchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  ProjectRangeSchema,
  ProjectTimeReportSchema,
  RunningTimerSchema,
  TaskOptionListSchema,
  TaskTimeSchema,
  WeeklyTimeSchema,
} from "@/src/server/time/time-contracts";
import {
  TimeTracking,
  TimeTrackingLive,
} from "@/src/server/time/time-tracking";

type TimeService = TimeTracking["Service"];

// Every time read signs the caller in as an employee first: clients never see
// time entries.
const readTime = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  OutputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  read: (
    time: TimeService,
    actorId: string,
    validated: InputSchema["Type"]
  ) => Effect.Effect<OutputSchema["Type"], AppError>,
  outputSchema: OutputSchema
) =>
  runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* run() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const time = yield* TimeTracking;
        return yield* read(time, actor.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TimeTrackingLive)
      ),
    undefined,
    outputSchema
  );

export const getRunningTimer = async (input: unknown) =>
  await readTime(
    input,
    Schema.Struct({}),
    (time, actorId) => time.runningTimer(actorId),
    Schema.NullOr(RunningTimerSchema)
  );

export const getTaskTime = async (input: unknown) =>
  await readTime(
    input,
    Schema.Struct({ taskId: UUIDSchema }),
    (time, actorId, { taskId }) => time.taskTime(actorId, taskId),
    TaskTimeSchema
  );

export const getWeeklyTime = async (input: unknown) =>
  await readTime(
    input,
    Schema.Struct({ date: CalendarDateSchema }),
    (time, actorId, { date }) => time.weeklyTime(actorId, date),
    WeeklyTimeSchema
  );

export const listAssignedTaskOptions = async (input: unknown) =>
  await readTime(
    input,
    Schema.Struct({}),
    (time, actorId) => time.assignedTasks(actorId),
    TaskOptionListSchema
  );

export const getProjectTimeReport = async (input: unknown) =>
  await readTime(
    input,
    ProjectRangeSchema,
    (time, actorId, { projectId, ...range }) =>
      time.projectReport(actorId, projectId, range),
    ProjectTimeReportSchema
  );
