import { Effect, Schema } from "effect";

import { AppError } from "../core/action-result";
import { AUTOMATION_TRIGGERS } from "./automation-model";

export const AutomationJobPayloadSchema = Schema.Struct({
  causedByRuleId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  depth: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  eventId: Schema.String.check(Schema.isUUID()),
  projectId: Schema.String.check(Schema.isUUID()),
  taskId: Schema.String.check(Schema.isUUID()),
  trigger: Schema.Literals(AUTOMATION_TRIGGERS),
});
export type AutomationJobPayload = typeof AutomationJobPayloadSchema.Type;

export const decodeAutomationJob = (payload: unknown) =>
  Effect.try({
    catch: () =>
      new AppError({
        code: "VALIDATION_FAILED",
        message: "The automation job payload is invalid.",
      }),
    try: () => Schema.decodeUnknownSync(AutomationJobPayloadSchema)(payload),
  });
