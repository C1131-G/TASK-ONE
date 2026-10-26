import { Effect } from "effect";

import type { MobileMyWork } from "../../../mobile-api/routes-tasks";
import { AuthSession } from "../../auth/session";
import type { AppError } from "../../core/action-result";
import { listMyWork } from "../../work/work-my-tasks";
import type { MyWorkQuery } from "../../work/work-my-tasks";

const DEFAULT_PAGE_SIZE = 25;

export interface MyWorkParams {
  readonly scope?: MyWorkQuery["scope"] | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

// The caller's open tasks. Staff only; the list is always their own.
export const getMyWork = (
  headers: Headers,
  query: MyWorkParams
): Effect.Effect<MobileMyWork, AppError, AuthSession> =>
  Effect.gen(function* resolveMyWork() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    return yield* listMyWork(actor.id, {
      limit: query.limit ?? DEFAULT_PAGE_SIZE,
      offset: query.offset ?? 0,
      scope: query.scope ?? "assigned",
    });
  });
