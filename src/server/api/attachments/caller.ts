import { Effect, Layer } from "effect";

import type {
  RouteDefinition,
  RouteInput,
} from "../../../mobile-api/route-definition";
import { AuthSession, AuthSessionLive } from "../../auth/session";
import type { PortalUser, WorkspaceUser } from "../../auth/session-types";
import type { AppError } from "../../core/action-result";
import { IdempotencyLive } from "../../core/idempotency";
import type { Idempotency } from "../../core/idempotency";
import { PortalBugsLive } from "../../portal/portal-bugs";
import type { PortalActor, PortalBugs } from "../../portal/portal-contracts";
import { StorageLive } from "../../storage/storage";
import { UploadsLive } from "../../storage/uploads";
import type { Uploads } from "../../storage/uploads-contracts";
import { BugWorkflowManagementLive } from "../../work/bug-workflow-management";
import type { BugWorkflowManagement } from "../../work/bug-workflow-management";
import { readRouteInput } from "../route-input";

export type PathParams = Readonly<Record<string, string>>;

export type StaffAttachmentServices =
  | BugWorkflowManagement
  | Idempotency
  | Uploads;
export type PortalAttachmentServices = Idempotency | PortalBugs | Uploads;

const uploadsLayer = Layer.provide(UploadsLive, StorageLive);

const staffLayer = Layer.mergeAll(
  BugWorkflowManagementLive,
  IdempotencyLive,
  uploadsLayer
);
const portalLayer = Layer.mergeAll(
  IdempotencyLive,
  PortalBugsLive,
  uploadsLayer
);

export const toPortalActor = (user: PortalUser): PortalActor => ({
  clientCompanyId: user.clientCompanyId,
  id: user.id,
  name: user.name,
});

// A staff member's attachment call. The session supplies who they are and the
// route's own schemas read the request, after authentication so a caller that
// is not signed in never learns what is wrong with its body.
export const asStaffAttachmentCaller = <Route extends RouteDefinition, Result>(
  route: Route,
  request: Request,
  params: PathParams,
  run: (caller: {
    readonly input: RouteInput<Route>;
    readonly user: WorkspaceUser;
  }) => Effect.Effect<Result, AppError, StaffAttachmentServices>
): Effect.Effect<Result, AppError> =>
  Effect.gen(function* staffCaller() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requireWorkspaceAccess(request.headers);
    const input = yield* readRouteInput(route, request, params);
    return yield* run({ input, user });
  }).pipe(Effect.provide(staffLayer), Effect.provide(AuthSessionLive));

// A client's attachment call. The company always comes from the session.
export const asPortalAttachmentCaller = <Route extends RouteDefinition, Result>(
  route: Route,
  request: Request,
  params: PathParams,
  run: (caller: {
    readonly actor: PortalActor;
    readonly input: RouteInput<Route>;
    readonly user: PortalUser;
  }) => Effect.Effect<Result, AppError, PortalAttachmentServices>
): Effect.Effect<Result, AppError> =>
  Effect.gen(function* portalCaller() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requirePortalAccess(request.headers);
    const input = yield* readRouteInput(route, request, params);
    return yield* run({ actor: toPortalActor(user), input, user });
  }).pipe(Effect.provide(portalLayer), Effect.provide(AuthSessionLive));
