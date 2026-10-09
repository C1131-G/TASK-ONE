import { Context } from "effect";
import type { Effect } from "effect";

import type { AppError } from "../core/action-result";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface JobHandlersApi {
  readonly handle: (
    kind: string,
    payload: JsonValue
  ) => Effect.Effect<void, AppError>;
}

export class JobHandlers extends Context.Service<JobHandlers, JobHandlersApi>()(
  "metsys/server/JobHandlers"
) {}
