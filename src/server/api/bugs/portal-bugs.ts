import { Effect } from "effect";

import { portalBugRoutes } from "../../../mobile-api/routes-bugs";
import { Idempotency } from "../../core/idempotency";
import {
  PortalBugs,
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
