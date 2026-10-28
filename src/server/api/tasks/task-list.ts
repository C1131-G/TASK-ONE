import { Effect } from "effect";

import type { MobileTaskList } from "../../../mobile-api/routes-tasks";
import { AuthSession } from "../../auth/session";
import type { AppError } from "../../core/action-result";
import { listTaskPage } from "../../work/work-task-list";

export interface TaskListParams {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  readonly mine?: "false" | "true" | undefined;
  readonly projectId?: string | undefined;
  readonly status?: string | undefined;
}

// Every open task for staff. Clients never reach it: the session refuses them.
export const readTaskList = (
  headers: Headers,
  query: TaskListParams
): Effect.Effect<MobileTaskList, AppError, AuthSession> =>
  Effect.gen(function* resolveTaskList() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    return yield* listTaskPage(actor.id, {
      ...query,
      mine: query.mine === "true",
    });
  });
