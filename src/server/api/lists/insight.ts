import { Effect } from "effect";

import {
  activityListRoute,
  workloadRoute,
} from "../../../mobile-api/routes-insight";
import {
  ActivityManagement,
  ActivityManagementLive,
} from "../../activity/activity-management";
import { AuthSession } from "../../auth/session";
import { TeamWorkload, TeamWorkloadLive } from "../../workload/team-workload";
import { pageOf } from "../paging";
import { readRouteInput } from "../route-input";

const ACTIVITY_WINDOW = 100;

export const listActivityPage = (request: Request) =>
  Effect.gen(function* list() {
    const { query } = yield* readRouteInput(activityListRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const entries = yield* (yield* ActivityManagement).list(
      actor.id,
      {},
      ACTIVITY_WINDOW
    );
    const rows = entries.map((entry) => ({
      action: entry.action,
      actorId: entry.actorId,
      actorName: entry.actorName,
      createdAt: entry.createdAt,
      id: entry.id,
      projectId: entry.projectId,
      projectName: entry.projectName,
      taskId: entry.taskId,
      taskTitle: entry.taskTitle,
    }));
    return yield* pageOf(rows, ({ id }) => id, query);
  }).pipe(Effect.provide(ActivityManagementLive));

export const readWorkload = (request: Request) =>
  Effect.gen(function* read() {
    yield* readRouteInput(workloadRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    return yield* (yield* TeamWorkload).view(actor.id, new Date());
  }).pipe(Effect.provide(TeamWorkloadLive));
