import { Effect } from "effect";

import type { RouteDefinition } from "../../../mobile-api/route-definition";
import { Idempotency } from "../../core/idempotency";
import { BugWorkflowReceiptSchema } from "../../work/bug-workflow-internal";
import { BugWorkflowManagement } from "../../work/bug-workflow-management";
import { asStaffCaller } from "./caller";
import type { PathParams } from "./caller";

interface WorkflowInput {
  readonly body: object;
  readonly idempotencyKey: string;
  readonly params: { readonly bugId: string };
}

type WorkflowOperation = keyof typeof BugWorkflowManagement.Service;

// One bug-workflow write for a staff member. The bug comes from the path, the
// rest from the body, and the service applies the same rules the web actions
// do: handlers, roles, versions. The write is made safe to retry here.
export const staffWorkflowWrite =
  <
    Route extends RouteDefinition & {
      readonly params: { readonly Type: { readonly bugId: string } };
    },
  >(
    route: Route,
    operation: WorkflowOperation,
    name: string
  ) =>
  (request: Request, params: PathParams) =>
    asStaffCaller(route, request, params, ({ input, user }) =>
      Effect.gen(function* write() {
        const workflow = yield* BugWorkflowManagement;
        const idempotency = yield* Idempotency;
        // Every workflow route has the same three parts, which the route's own
        // schemas have already checked.
        const {
          body,
          idempotencyKey,
          params: path,
        } = input as unknown as WorkflowInput;
        const workflowInput = { ...body, bugId: path.bugId };
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            (
              workflow[operation] as (
                actorId: string,
                value: never
              ) => ReturnType<typeof workflow.pick>
            )(user.id, workflowInput as never),
          input: workflowInput,
          key: idempotencyKey,
          operation: `bug.workflow.${name}`,
          resultSchema: BugWorkflowReceiptSchema,
        });
      })
    );
