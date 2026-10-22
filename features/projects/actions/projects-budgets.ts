import "server-only";
import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { AuthSessionLive } from "@/src/server/auth/session";
import {
  BudgetInputFieldsSchema,
  ProjectBudgetViewSchema,
} from "@/src/server/budgets/budget-contracts";
import {
  ProjectBudgets,
  ProjectBudgetsLive,
} from "@/src/server/budgets/project-budgets";
import { requireAdmin } from "@/src/server/core/admin-action";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

const ClearedSchema = Schema.Struct({
  ...DoneResultSchema.fields,
  projectId: Schema.String,
});

const refreshProject = (projectId: string): void => {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/time`);
  refresh();
};

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function saveProjectBudgetAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...BudgetInputFieldsSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
      projectId: UUIDSchema,
    }),
    ({ idempotencyKey, projectId, ...budget }) =>
      Effect.gen(function* saveBudget() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const budgets = yield* ProjectBudgets;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            budgets.save(administrator.id, projectId, budget, new Date()),
          input: { ...budget, projectId },
          key: idempotencyKey,
          operation: "project.saveBudget",
          resultSchema: ProjectBudgetViewSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectBudgetsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ProjectBudgetViewSchema
  );
  if (result.ok) {
    refreshProject(result.data.projectId);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function clearProjectBudgetAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      projectId: UUIDSchema,
    }),
    ({ idempotencyKey, projectId }) =>
      Effect.gen(function* clearBudget() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const budgets = yield* ProjectBudgets;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            Effect.map(budgets.clear(administrator.id, projectId), () => ({
              done: true as const,
              projectId,
            })),
          input: { projectId },
          key: idempotencyKey,
          operation: "project.clearBudget",
          resultSchema: ClearedSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectBudgetsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ClearedSchema
  );
  if (result.ok) {
    refreshProject(result.data.projectId);
  }
  return result;
}
