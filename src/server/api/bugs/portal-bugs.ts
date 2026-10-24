import { Effect } from "effect";

import {
  portalBugActionRoutes,
  portalBugRoutes,
} from "../../../mobile-api/routes-bugs";
import { Idempotency } from "../../core/idempotency";
import {
  PortalBugs,
  PortalCommentSchema,
  PortalBugReceiptSchema,
} from "../../portal/portal-contracts";
import { asPortalCaller } from "./caller";
import type { PathParams } from "./caller";

export const listPortalBugs = (request: Request) =>
  asPortalCaller(portalBugRoutes.list, request, {}, ({ actor, input }) =>
    Effect.gen(function* list() {
      const bugs = yield* PortalBugs;
      const { mine, projectId, status } = input.query;
      return yield* bugs.listBugs(actor, {
        ...(mine === undefined ? {} : { mine: mine === "true" }),
        ...(projectId === undefined ? {} : { projectId }),
        ...(status === undefined ? {} : { status }),
      });
    })
  );

export const getPortalBug = (request: Request, params: PathParams) =>
  asPortalCaller(portalBugRoutes.detail, request, params, ({ actor, input }) =>
    Effect.gen(function* detail() {
      const bugs = yield* PortalBugs;
      return yield* bugs.getBug(actor, input.params.bugId);
    })
  );

export const submitPortalBug = (request: Request) =>
  asPortalCaller(
    portalBugRoutes.submit,
    request,
    {},
    ({ actor, input, user }) =>
      Effect.gen(function* submit() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.submitBug(actor, input.body),
          input: input.body,
          key: input.idempotencyKey,
          operation: "portal.bug.submit",
          resultSchema: PortalBugReceiptSchema,
        });
      })
  );

export const addPortalBugComment = (request: Request, params: PathParams) =>
  asPortalCaller(
    portalBugActionRoutes.comment,
    request,
    params,
    ({ actor, input, user }) =>
      Effect.gen(function* comment() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const commentInput = {
          body: input.body.body,
          bugId: input.params.bugId,
        };
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.addComment(actor, commentInput),
          input: commentInput,
          key: input.idempotencyKey,
          operation: "portal.bug.comment",
          resultSchema: PortalCommentSchema,
        });
      })
  );

export const confirmPortalBugFix = (request: Request, params: PathParams) =>
  asPortalCaller(
    portalBugActionRoutes.confirm,
    request,
    params,
    ({ actor, input, user }) =>
      Effect.gen(function* confirm() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const fixInput = { ...input.body, bugId: input.params.bugId };
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.confirmFix(actor, fixInput),
          input: fixInput,
          key: input.idempotencyKey,
          operation: "portal.bug.confirm",
          resultSchema: PortalBugReceiptSchema,
        });
      })
  );

export const reopenPortalBugFix = (request: Request, params: PathParams) =>
  asPortalCaller(
    portalBugActionRoutes.reopen,
    request,
    params,
    ({ actor, input, user }) =>
      Effect.gen(function* reopen() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const fixInput = { ...input.body, bugId: input.params.bugId };
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.reopenFix(actor, fixInput),
          input: fixInput,
          key: input.idempotencyKey,
          operation: "portal.bug.reopen",
          resultSchema: PortalBugReceiptSchema,
        });
      })
  );
