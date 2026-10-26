import { Effect, Layer } from "effect";

import type {
  RouteDefinition,
  RouteInput,
} from "../../../mobile-api/route-definition";
import type { Approvals } from "../../approvals/approval-contracts";
import { PortalApprovalsLive, ApprovalsLive } from "../../approvals/approvals";
import type { PortalApprovals } from "../../approvals/portal-approvals-service";
import { AuthSession, AuthSessionLive } from "../../auth/session";
import type { PortalUser, WorkspaceUser } from "../../auth/session-types";
import { CollaborationLive } from "../../collaboration/service";
import type { Collaboration } from "../../collaboration/service";
import type { AppError } from "../../core/action-result";
import { IdempotencyLive } from "../../core/idempotency";
import type { Idempotency } from "../../core/idempotency";
import { PortalBugsLive } from "../../portal/portal-bugs";
import type { PortalActor, PortalBugs } from "../../portal/portal-contracts";
import { BugApprovalInboxLive } from "../../work/bug-approval-inbox";
import type { BugApprovalInbox } from "../../work/bug-approval-inbox";
import { BugHistoryLive } from "../../work/bug-history";
import type { BugHistory } from "../../work/bug-history";
import { BugManagementLive } from "../../work/bug-management";
import type { BugManagement } from "../../work/bug-management";
import { BugWorkflowManagementLive } from "../../work/bug-workflow-management";
import type { BugWorkflowManagement } from "../../work/bug-workflow-management";
import { readRouteInput } from "../route-input";

export type PathParams = Readonly<Record<string, string>>;

export type PortalServices = PortalBugs | PortalApprovals | Idempotency;
export type StaffServices =
  | Approvals
  | BugApprovalInbox
  | BugHistory
  | BugManagement
  | BugWorkflowManagement
  | Collaboration
  | Idempotency;

export const toPortalActor = (user: PortalUser): PortalActor => ({
  clientCompanyId: user.clientCompanyId,
  id: user.id,
  name: user.name,
});

const portalLayer = Layer.mergeAll(
  PortalBugsLive,
  PortalApprovalsLive,
  IdempotencyLive
);
const staffLayer = Layer.mergeAll(
  ApprovalsLive,
  BugApprovalInboxLive,
  BugHistoryLive,
  BugManagementLive,
  BugWorkflowManagementLive,
  CollaborationLive,
  IdempotencyLive
);

// A client's call: the session supplies the company, then the route's own
// schemas read the request. Authentication is checked before the input, so an
// unauthenticated call never learns what is wrong with its body.
export const asPortalCaller = <Route extends RouteDefinition, Result>(
  route: Route,
  request: Request,
  params: PathParams,
  run: (caller: {
    readonly actor: PortalActor;
    readonly input: RouteInput<Route>;
    readonly user: PortalUser;
  }) => Effect.Effect<Result, AppError, PortalServices>
): Effect.Effect<Result, AppError> =>
  Effect.gen(function* portalCaller() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requirePortalAccess(request.headers);
    const input = yield* readRouteInput(route, request, params);
    return yield* run({ actor: toPortalActor(user), input, user });
  }).pipe(Effect.provide(portalLayer), Effect.provide(AuthSessionLive));

// A staff member's call, authorized the same way.
export const asStaffCaller = <Route extends RouteDefinition, Result>(
  route: Route,
  request: Request,
  params: PathParams,
  run: (caller: {
    readonly input: RouteInput<Route>;
    readonly user: WorkspaceUser;
  }) => Effect.Effect<Result, AppError, StaffServices>
): Effect.Effect<Result, AppError> =>
  Effect.gen(function* staffCaller() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requireWorkspaceAccess(request.headers);
    const input = yield* readRouteInput(route, request, params);
    return yield* run({ input, user });
  }).pipe(Effect.provide(staffLayer), Effect.provide(AuthSessionLive));
