import "server-only";
import { Effect, Schema } from "effect";

import { AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import { IntakeFormListSchema } from "@/src/server/intake/intake-form-contracts";
import {
  IntakeFormManagement,
  IntakeFormManagementLive,
} from "@/src/server/intake/intake-forms";

export const listIntakeForms = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* listIntakeFormsProgram() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const forms = yield* IntakeFormManagement;
        return yield* forms.list(administrator.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(IntakeFormManagementLive)
      ),
    undefined,
    IntakeFormListSchema
  );
