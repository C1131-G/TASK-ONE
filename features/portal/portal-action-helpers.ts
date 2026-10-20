import { Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";

export const withKey = <Fields extends Schema.Struct.Fields>(
  schema: Schema.Struct<Fields>
) => Schema.Struct({ ...schema.fields, idempotencyKey: IdempotencyKeySchema });

// The bug an action was aimed at, read from the raw input only to refresh
// its page; the action itself validates the input.
export const bugIdOf = (input: unknown): string | undefined => {
  if (typeof input !== "object" || input === null || !("bugId" in input)) {
    return undefined;
  }
  return typeof input.bugId === "string" ? input.bugId : undefined;
};

export const revalidatePortal = (bugId?: string) => {
  revalidatePath("/portal");
  revalidatePath("/bugs");
  if (bugId) {
    revalidatePath(`/portal/bugs/${bugId}`);
  }
  refresh();
};
