import { and } from "@prisma/orm-postgres/orm-client";
import { Option, Schema } from "effect";

import {
  BrowserContextSchema,
  CLIENT_CONTEXT_ACTION,
} from "../portal/portal-browser-context";
import type { BrowserContext } from "../portal/portal-browser-context";
import type { Transaction } from "./work-internal";

const decodeContext = Schema.decodeUnknownOption(BrowserContextSchema);

// The browser context a client sent with a report, for the team only. A row
// that no longer fits the schema is treated as absent instead of shown.
export const loadClientContext = async (
  transaction: Transaction,
  taskId: string
): Promise<BrowserContext | null> => {
  const row = await transaction.orm.public.Activity.where((activity) =>
    and(activity.taskId.eq(taskId), activity.action.eq(CLIENT_CONTEXT_ACTION))
  )
    .orderBy((activity) => activity.createdAt.desc())
    .first();
  return row ? Option.getOrNull(decodeContext(row.details)) : null;
};
