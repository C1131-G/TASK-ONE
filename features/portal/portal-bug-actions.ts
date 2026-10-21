"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { Effect } from "effect";

import {
  bugIdOf,
  revalidatePortal,
  withKey,
} from "@/features/portal/portal-action-helpers";
import {
  runPortalAction,
  toPortalActor,
} from "@/features/portal/portal-action-runner";
import { DoneResultSchema, Idempotency } from "@/src/server/core/idempotency";
import {
  PortalBugReceiptSchema,
  PortalBugs,
  PortalCommentSchema,
} from "@/src/server/portal/portal-contracts";
import {
  ClientBugVersionInputSchema,
  ClientCommentInputSchema,
  ConfirmClientFixInputSchema,
  EditClientBugInputSchema,
  RateClientBugInputSchema,
  ReopenClientFixInputSchema,
  SubmitClientBugInputSchema,
} from "@/src/server/portal/portal-input-contracts";

export async function submitClientBugAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(SubmitClientBugInputSchema),
    (user, validated) =>
      Effect.gen(function* submitClientBug() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...bugInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.submitBug(toPortalActor(user), bugInput),
          input: bugInput,
          key: idempotencyKey,
          operation: "portal.bug.submit",
          resultSchema: PortalBugReceiptSchema,
        });
      }),
    PortalBugReceiptSchema
  );
  if (result.ok) {
    revalidatePortal(result.data.bugId);
  }
  return result;
}

export async function editClientBugAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(EditClientBugInputSchema),
    (user, validated) =>
      Effect.gen(function* editClientBug() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...bugInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.editBug(toPortalActor(user), bugInput),
          input: bugInput,
          key: idempotencyKey,
          operation: "portal.bug.edit",
          resultSchema: PortalBugReceiptSchema,
        });
      }),
    PortalBugReceiptSchema
  );
  if (result.ok) {
    revalidatePortal(result.data.bugId);
  }
  return result;
}

export async function withdrawClientBugAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(ClientBugVersionInputSchema),
    (user, validated) =>
      Effect.gen(function* withdrawClientBug() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...bugInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.withdrawBug(toPortalActor(user), bugInput),
          input: bugInput,
          key: idempotencyKey,
          operation: "portal.bug.withdraw",
          resultSchema: PortalBugReceiptSchema,
        });
      }),
    PortalBugReceiptSchema
  );
  if (result.ok) {
    revalidatePortal(result.data.bugId);
  }
  return result;
}

export async function confirmClientFixAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(ConfirmClientFixInputSchema),
    (user, validated) =>
      Effect.gen(function* confirmClientFix() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...fixInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.confirmFix(toPortalActor(user), fixInput),
          input: fixInput,
          key: idempotencyKey,
          operation: "portal.bug.confirm",
          resultSchema: PortalBugReceiptSchema,
        });
      }),
    PortalBugReceiptSchema
  );
  if (result.ok) {
    revalidatePortal(result.data.bugId);
  }
  return result;
}

export async function reopenClientFixAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(ReopenClientFixInputSchema),
    (user, validated) =>
      Effect.gen(function* reopenClientFix() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...fixInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.reopenFix(toPortalActor(user), fixInput),
          input: fixInput,
          key: idempotencyKey,
          operation: "portal.bug.reopen",
          resultSchema: PortalBugReceiptSchema,
        });
      }),
    PortalBugReceiptSchema
  );
  if (result.ok) {
    revalidatePortal(result.data.bugId);
  }
  return result;
}

export async function rateClientBugAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(RateClientBugInputSchema),
    (user, validated) =>
      Effect.gen(function* rateClientBug() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...ratingInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            bugs
              .rateBug(toPortalActor(user), ratingInput)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: ratingInput,
          key: idempotencyKey,
          operation: "portal.bug.rate",
          resultSchema: DoneResultSchema,
        });
      }),
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePortal(bugIdOf(input));
  }
  return result;
}

export async function addClientCommentAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(ClientCommentInputSchema),
    (user, validated) =>
      Effect.gen(function* addClientComment() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...commentInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.addComment(toPortalActor(user), commentInput),
          input: commentInput,
          key: idempotencyKey,
          operation: "portal.bug.comment",
          resultSchema: PortalCommentSchema,
        });
      }),
    PortalCommentSchema
  );
  if (result.ok) {
    revalidatePortal(bugIdOf(input));
  }
  return result;
}
