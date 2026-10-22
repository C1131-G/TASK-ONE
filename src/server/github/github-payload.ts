import { Schema } from "effect";

import type { PullState } from "./github-contracts";
import { isRepoFullName } from "./github-contracts";

// Only the fields a link needs. Everything else in a GitHub payload is
// ignored, and nothing here is trusted until the signature has been checked.

const MAX_PULL_NUMBER = 2_147_483_647;
const HANDLED_ACTIONS = ["opened", "reopened", "edited", "closed"] as const;

const PullNumberSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ maximum: MAX_PULL_NUMBER, minimum: 1 })
);

const PullEventSchema = Schema.Struct({
  action: Schema.String,
  pull_request: Schema.Struct({
    body: Schema.optional(Schema.NullOr(Schema.String)),
    head: Schema.Struct({ ref: Schema.String }),
    merged: Schema.optional(Schema.NullOr(Schema.Boolean)),
    merged_at: Schema.optional(Schema.NullOr(Schema.String)),
    number: PullNumberSchema,
    state: Schema.optional(Schema.NullOr(Schema.String)),
    title: Schema.String,
    user: Schema.optional(
      Schema.NullOr(Schema.Struct({ login: Schema.String }))
    ),
  }),
});

export interface PullEvent {
  readonly action: (typeof HANDLED_ACTIONS)[number];
  readonly authorLogin: string | null;
  readonly body: string | null;
  readonly branch: string;
  readonly mergedAt: Date | null;
  readonly number: number;
  readonly state: PullState;
  readonly title: string;
}

/** The repository a delivery claims to come from, or null when it names none. */
export const claimedRepository = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { repository } = value as Record<string, unknown>;
  if (typeof repository !== "object" || repository === null) {
    return null;
  }
  const name = (repository as Record<string, unknown>)["full_name"];
  return typeof name === "string" && isRepoFullName(name) ? name : null;
};

export const isHandledAction = (action: unknown): boolean =>
  HANDLED_ACTIONS.some((handled) => handled === action);

const stateOf = (
  action: string,
  pull: {
    readonly merged?: boolean | null | undefined;
    readonly state?: string | null | undefined;
  }
): PullState => {
  if (pull.merged === true) {
    return "merged";
  }
  return pull.state === "closed" || action === "closed" ? "closed" : "open";
};

const mergedAtOf = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const decodePullEvent = (value: unknown): PullEvent | null => {
  const decoded = Schema.decodeUnknownExit(PullEventSchema)(value);
  if (decoded._tag !== "Success") {
    return null;
  }
  const { action, pull_request: pull } = decoded.value;
  const handled = HANDLED_ACTIONS.find((candidate) => candidate === action);
  if (!handled) {
    return null;
  }
  return {
    action: handled,
    authorLogin: pull.user?.login ?? null,
    body: pull.body ?? null,
    branch: pull.head.ref,
    mergedAt: mergedAtOf(pull.merged_at),
    number: pull.number,
    state: stateOf(action, pull),
    title: pull.title,
  };
};
