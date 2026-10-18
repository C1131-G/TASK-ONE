"use server";

import { Effect } from "effect";

import {
  BugPickInputSchema,
  BugReassignInputSchema,
} from "@/src/server/work/bug-contracts";
import {
  CloseNotABugInputSchema,
  RequestClientInfoInputSchema,
} from "@/src/server/work/bug-workflow-client-support";
import { BugWorkflowManagement } from "@/src/server/work/bug-workflow-management";

import {
  revalidateBugViews,
  runBugWorkflowAction,
} from "./actions/bug-workflow-runner";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function pickClientBugAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(input, BugPickInputSchema, (actorId, value) =>
      Effect.gen(function* pick() {
        const service = yield* BugWorkflowManagement;
        return yield* service.pick(actorId, value);
      })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function requestClientInfoAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      RequestClientInfoInputSchema,
      (actorId, value) =>
        Effect.gen(function* requestInfo() {
          const service = yield* BugWorkflowManagement;
          return yield* service.requestInfo(actorId, value);
        })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function closeClientBugNotABugAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      CloseNotABugInputSchema,
      (actorId, value) =>
        Effect.gen(function* closeNotABug() {
          const service = yield* BugWorkflowManagement;
          return yield* service.closeNotABug(actorId, value);
        })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function reassignClientBugAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      BugReassignInputSchema,
      (actorId, value) =>
        Effect.gen(function* reassign() {
          const service = yield* BugWorkflowManagement;
          return yield* service.reassign(actorId, value);
        })
    )
  );
}
