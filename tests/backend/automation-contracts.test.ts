import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  MAX_ACTIONS_PER_RULE,
  MAX_CONDITIONS_PER_RULE,
  MAX_RULES_PER_PROJECT,
  AutomationRuleInputSchema,
} from "../../src/server/automation/automation-contracts";

const decode = (value: unknown) =>
  Schema.decodeUnknownSync(AutomationRuleInputSchema)(value);

const valid = {
  actions: [{ priority: "high", type: "set_priority" }],
  conditions: [{ field: "status", op: "in", values: ["todo"] }],
  name: "Escalate",
  trigger: "status_changed",
} as const;

describe("AutomationRuleInputSchema", () => {
  it("accepts a typed rule and keeps its shape", () => {
    expect(decode(valid)).toEqual(valid);
    expect(MAX_RULES_PER_PROJECT).toBeGreaterThan(0);
  });

  it("accepts every action type", () => {
    const actions = [
      { status: "done", type: "set_status" },
      { priority: "low", type: "set_priority" },
      { type: "assign", userId: "user-1" },
      { type: "unassign", userId: "user-1" },
      { labelId: crypto.randomUUID(), type: "add_label" },
      { body: "Looks stale", type: "post_comment" },
      { message: "Check this", type: "notify", userId: "user-2" },
    ];
    expect(() =>
      decode({ ...valid, actions: actions.slice(0, MAX_ACTIONS_PER_RULE) })
    ).not.toThrow();
    for (const action of actions) {
      expect(() => decode({ ...valid, actions: [action] })).not.toThrow();
    }
  });

  it("rejects unknown triggers, fields, operators and action types", () => {
    expect(() => decode({ ...valid, trigger: "task_deleted" })).toThrow();
    expect(() =>
      decode({
        ...valid,
        conditions: [{ field: "title", op: "in", values: ["x"] }],
      })
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        conditions: [{ field: "status", op: "regex", values: ["x"] }],
      })
    ).toThrow();
    expect(() =>
      decode({ ...valid, actions: [{ script: "1+1", type: "run_code" }] })
    ).toThrow();
  });

  it("rejects values outside the enumerations", () => {
    expect(() =>
      decode({
        ...valid,
        actions: [{ status: "archived", type: "set_status" }],
      })
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        conditions: [{ field: "status", op: "in", values: ["nope"] }],
      })
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        conditions: [{ field: "taskType", op: "in", values: ["epic"] }],
      })
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        actions: [{ labelId: "not-a-uuid", type: "add_label" }],
      })
    ).toThrow();
  });

  it("enforces action, condition and value limits", () => {
    expect(() => decode({ ...valid, actions: [] })).toThrow();
    expect(() =>
      decode({
        ...valid,
        actions: Array.from({ length: MAX_ACTIONS_PER_RULE + 1 }, () => ({
          priority: "low",
          type: "set_priority",
        })),
      })
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        conditions: Array.from({ length: MAX_CONDITIONS_PER_RULE + 1 }, () => ({
          field: "status",
          op: "in",
          values: ["todo"],
        })),
      })
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        conditions: [{ field: "status", op: "in", values: [] }],
      })
    ).toThrow();
  });

  it("enforces name and text limits", () => {
    expect(() => decode({ ...valid, name: "   " })).toThrow();
    expect(() => decode({ ...valid, name: "x".repeat(81) })).toThrow();
    expect(() =>
      decode({
        ...valid,
        actions: [{ body: "x".repeat(1001), type: "post_comment" }],
      })
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        actions: [{ body: "  ", type: "post_comment" }],
      })
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        actions: [{ message: "x".repeat(201), type: "notify", userId: "u" }],
      })
    ).toThrow();
  });

  it("drops extra fields so a rule cannot smuggle data into storage", () => {
    expect(
      decode({ ...valid, actions: [{ ...valid.actions[0], extra: 1 }] })
    ).toEqual(valid);
  });
});
