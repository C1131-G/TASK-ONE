import { describe, expect, it } from "bun:test";

import {
  MAX_AUTOMATION_DEPTH,
  RATE_LIMIT_MAX_RUNS,
  actionBlockedReason,
  conditionMatches,
  decideRun,
  eventsCausedBy,
} from "../../src/server/automation/automation-evaluator";
import type {
  AutomationCondition,
  AutomationEvent,
  AutomationRuleDefinition,
  TaskSnapshot,
} from "../../src/server/automation/automation-model";

const snapshot: TaskSnapshot = {
  archived: false,
  assigneeIds: ["u1", "u2"],
  hasRecurrence: false,
  labelIds: ["l1"],
  priority: "high",
  status: "todo",
  type: "task",
};

const rule = (
  overrides: Partial<AutomationRuleDefinition> = {}
): AutomationRuleDefinition => ({
  actions: [{ priority: "urgent", type: "set_priority" }],
  conditions: [],
  enabled: true,
  id: "rule-1",
  trigger: "status_changed",
  ...overrides,
});

const event = (overrides: Partial<AutomationEvent> = {}): AutomationEvent => ({
  causedByRuleId: null,
  depth: 0,
  eventId: "event-1",
  trigger: "status_changed",
  ...overrides,
});

describe("conditionMatches truth table", () => {
  const cases: readonly (readonly [AutomationCondition, boolean])[] = [
    [{ field: "status", op: "in", values: ["todo", "done"] }, true],
    [{ field: "status", op: "in", values: ["done"] }, false],
    [{ field: "status", op: "not_in", values: ["done"] }, true],
    [{ field: "status", op: "not_in", values: ["todo"] }, false],
    [{ field: "priority", op: "in", values: ["high"] }, true],
    [{ field: "priority", op: "not_in", values: ["high", "urgent"] }, false],
    [{ field: "taskType", op: "in", values: ["bug"] }, false],
    [{ field: "taskType", op: "not_in", values: ["bug"] }, true],
    [{ field: "assignee", op: "in", values: ["u2", "u9"] }, true],
    [{ field: "assignee", op: "in", values: ["u9"] }, false],
    [{ field: "assignee", op: "not_in", values: ["u9"] }, true],
    [{ field: "assignee", op: "not_in", values: ["u1"] }, false],
    [{ field: "label", op: "in", values: ["l1"] }, true],
    [{ field: "label", op: "in", values: ["l2"] }, false],
    [{ field: "label", op: "not_in", values: ["l2"] }, true],
    [{ field: "label", op: "not_in", values: ["l1"] }, false],
  ];
  for (const [condition, expected] of cases) {
    it(`${condition.field} ${condition.op} ${condition.values.join(",")} is ${expected}`, () => {
      expect(conditionMatches(condition, snapshot)).toBe(expected);
    });
  }

  it("treats an unassigned task as matching 'assignee not in' and not 'assignee in'", () => {
    const unassigned = { ...snapshot, assigneeIds: [], labelIds: [] };
    expect(
      conditionMatches(
        { field: "assignee", op: "in", values: ["u1"] },
        unassigned
      )
    ).toBe(false);
    expect(
      conditionMatches(
        { field: "assignee", op: "not_in", values: ["u1"] },
        unassigned
      )
    ).toBe(true);
  });
});

const input = (
  overrides: Partial<Parameters<typeof decideRun>[0]> = {}
): Parameters<typeof decideRun>[0] => ({
  event: event(),
  recentRuns: 0,
  rule: rule(),
  task: snapshot,
  ...overrides,
});

describe("decideRun", () => {
  it("matches when trigger and every condition hold", () => {
    expect(
      decideRun(
        input({
          rule: rule({
            conditions: [
              { field: "status", op: "in", values: ["todo"] },
              { field: "priority", op: "not_in", values: ["low"] },
            ],
          }),
        })
      )
    ).toEqual({ outcome: "matched" });
  });

  it("ignores rules for other triggers and disabled rules", () => {
    expect(
      decideRun(input({ rule: rule({ trigger: "priority_changed" }) }))
    ).toEqual({ outcome: "not_applicable" });
    expect(decideRun(input({ rule: rule({ enabled: false }) }))).toEqual({
      outcome: "not_applicable",
    });
  });

  it("skips when one condition fails", () => {
    expect(
      decideRun(
        input({
          rule: rule({
            conditions: [
              { field: "status", op: "in", values: ["todo"] },
              { field: "label", op: "in", values: ["missing"] },
            ],
          }),
        })
      )
    ).toEqual({ outcome: "skipped", reason: "conditions_not_met" });
  });

  it("skips archived tasks", () => {
    expect(decideRun(input({ task: { ...snapshot, archived: true } }))).toEqual(
      { outcome: "skipped", reason: "task_archived" }
    );
  });

  it("evaluates events at the maximum depth but not beyond it", () => {
    expect(MAX_AUTOMATION_DEPTH).toBe(1);
    expect(
      decideRun(input({ event: event({ causedByRuleId: "other", depth: 1 }) }))
    ).toEqual({ outcome: "matched" });
    expect(
      decideRun(input({ event: event({ causedByRuleId: "other", depth: 2 }) }))
    ).toEqual({ outcome: "skipped", reason: "loop_protection_depth" });
  });

  it("never re-triggers a rule from its own change", () => {
    expect(
      decideRun(input({ event: event({ causedByRuleId: "rule-1", depth: 1 }) }))
    ).toEqual({ outcome: "skipped", reason: "loop_protection_self" });
  });

  it("rate limits a rule per task from the recent run count", () => {
    expect(decideRun(input({ recentRuns: RATE_LIMIT_MAX_RUNS - 1 }))).toEqual({
      outcome: "matched",
    });
    expect(decideRun(input({ recentRuns: RATE_LIMIT_MAX_RUNS }))).toEqual({
      outcome: "skipped",
      reason: "rate_limited",
    });
  });

  it("reports loop protection before conditions and rate limits", () => {
    expect(
      decideRun(
        input({
          event: event({ causedByRuleId: "rule-1", depth: 2 }),
          recentRuns: 99,
          rule: rule({
            conditions: [{ field: "status", op: "in", values: ["done"] }],
          }),
        })
      )
    ).toEqual({ outcome: "skipped", reason: "loop_protection_depth" });
  });

  it("refuses an action set the task cannot take", () => {
    expect(
      decideRun(
        input({
          rule: rule({ actions: [{ status: "done", type: "set_status" }] }),
          task: { ...snapshot, hasRecurrence: true },
        })
      )
    ).toEqual({
      outcome: "skipped",
      reason: "action_blocked:set_status",
    });
  });
});

describe("actionBlockedReason", () => {
  it("lets ordinary tasks take every action", () => {
    expect(
      actionBlockedReason({ status: "done", type: "set_status" }, snapshot)
    ).toBeNull();
    expect(
      actionBlockedReason({ type: "assign", userId: "u3" }, snapshot)
    ).toBeNull();
  });

  it("keeps bug tasks on the bug workflow for status and assignment", () => {
    const bug = { ...snapshot, type: "bug" } as const;
    expect(
      actionBlockedReason({ status: "done", type: "set_status" }, bug)
    ).toBe("set_status");
    expect(actionBlockedReason({ type: "assign", userId: "u3" }, bug)).toBe(
      "assign"
    );
    expect(actionBlockedReason({ type: "unassign", userId: "u1" }, bug)).toBe(
      "unassign"
    );
    expect(
      actionBlockedReason({ priority: "low", type: "set_priority" }, bug)
    ).toBeNull();
    expect(
      actionBlockedReason({ body: "Note", type: "post_comment" }, bug)
    ).toBeNull();
  });

  it("does not complete a recurring task, which needs its successor", () => {
    const recurring = { ...snapshot, hasRecurrence: true };
    expect(
      actionBlockedReason({ status: "done", type: "set_status" }, recurring)
    ).toBe("set_status");
    expect(
      actionBlockedReason({ status: "review", type: "set_status" }, recurring)
    ).toBeNull();
  });
});

describe("eventsCausedBy", () => {
  it("emits one deeper event per changed field and none for no-ops", () => {
    const next = eventsCausedBy({
      changes: {
        assigneesChanged: false,
        priorityChanged: true,
        statusChanged: true,
      },
      depth: 0,
      ruleId: "rule-1",
    });
    expect(next.map(({ trigger }) => trigger)).toEqual([
      "status_changed",
      "priority_changed",
    ]);
    for (const caused of next) {
      expect(caused.depth).toBe(1);
      expect(caused.causedByRuleId).toBe("rule-1");
    }
    expect(
      eventsCausedBy({
        changes: {
          assigneesChanged: false,
          priorityChanged: false,
          statusChanged: false,
        },
        depth: 0,
        ruleId: "rule-1",
      })
    ).toEqual([]);
  });
});
