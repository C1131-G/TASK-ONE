import { expect, it } from "bun:test";

import {
  describeReason,
  emptyActionDraft,
  describeRule,
  draftToRuleInput,
  emptyRuleDraft,
  outcomeBadge,
  ruleToDraft,
} from "../../features/projects/automation-form";
import type { AutomationRuleSummary } from "../../src/server/automation/automation-contracts";

const LABEL_ID = "9b2f6f3e-0c52-4a35-9a5e-2f6f3a1c7d10";
const lookups = {
  labels: new Map([[LABEL_ID, "Urgent"]]),
  people: new Map([["u1", "Ada Admin"]]),
};

const rule: AutomationRuleSummary = {
  actions: [
    { type: "assign", userId: "u1" },
    { labelId: LABEL_ID, type: "add_label" },
    { body: "Escalated", type: "post_comment" },
  ],
  conditions: [
    { field: "status", op: "in", values: ["todo", "progress"] },
    { field: "priority", op: "not_in", values: ["low"] },
  ],
  createdAt: "2026-10-22T00:00:00.000Z",
  enabled: true,
  id: "r1",
  name: "Escalate",
  projectId: "p1",
  trigger: "status_changed",
  updatedAt: "2026-10-22T00:00:00.000Z",
  version: 3,
};

it("describes a rule in words, with people and labels by name", () => {
  expect(describeRule(rule, lookups)).toEqual({
    actions: [
      "Assign Ada Admin",
      "Add label Urgent",
      'Post internal comment "Escalated"',
    ],
    conditions: ["Status is To Do or In Progress", "Priority is not Low"],
    when: "Status changed",
  });
});

it("falls back to a neutral name for a person or label that is gone", () => {
  const described = describeRule(rule, {
    labels: new Map(),
    people: new Map(),
  });
  expect(described.actions[0]).toBe("Assign a removed person");
  expect(described.actions[1]).toBe("Add label a removed label");
});

it("round-trips a stored rule through the form draft", () => {
  const draft = ruleToDraft(rule);
  expect(draft.name).toBe("Escalate");
  expect(draft.conditions).toHaveLength(2);
  const converted = draftToRuleInput(draft);
  expect(converted).toEqual({
    input: {
      actions: rule.actions,
      conditions: rule.conditions,
      name: "Escalate",
      trigger: "status_changed",
    },
    ok: true,
  });
});

it("builds each action type from its own fields", () => {
  const draft = {
    ...emptyRuleDraft(),
    actions: [
      { ...emptyActionDraft("set_status"), status: "done" },
      { ...emptyActionDraft("set_priority"), priority: "high" },
      { ...emptyActionDraft("unassign"), userId: "u1" },
      { ...emptyActionDraft("notify"), message: " Look ", userId: "u1" },
    ],
    name: "  Mixed ",
  };
  const converted = draftToRuleInput(draft);
  expect(converted).toEqual({
    input: {
      actions: [
        { status: "done", type: "set_status" },
        { priority: "high", type: "set_priority" },
        { type: "unassign", userId: "u1" },
        { message: "Look", type: "notify", userId: "u1" },
      ],
      conditions: [],
      name: "Mixed",
      trigger: "task_created",
    },
    ok: true,
  });
});

it("explains what is missing instead of submitting an incomplete rule", () => {
  expect(draftToRuleInput(emptyRuleDraft())).toEqual({
    message: "Enter a name for the automation.",
    ok: false,
  });
  expect(draftToRuleInput({ ...emptyRuleDraft(), name: "No actions" })).toEqual(
    { message: "Add at least one action.", ok: false }
  );
  const noPerson = {
    ...emptyRuleDraft(),
    actions: [emptyActionDraft("assign")],
    name: "No person",
  };
  expect(draftToRuleInput(noPerson)).toEqual({
    message: "Choose a person for every assign action.",
    ok: false,
  });
  const noValues = {
    ...emptyRuleDraft(),
    actions: [{ ...emptyActionDraft("set_status"), status: "done" }],
    conditions: [{ field: "status", key: "c1", op: "in", values: [] }],
    name: "Empty condition",
  } as const;
  expect(draftToRuleInput(noValues)).toEqual({
    message: "Choose at least one value for every condition.",
    ok: false,
  });
});

it("names run outcomes and reasons for the log", () => {
  expect(outcomeBadge("matched")).toEqual({ label: "Ran", tone: "green" });
  expect(outcomeBadge("skipped")).toEqual({ label: "Skipped", tone: "gray" });
  expect(outcomeBadge("failed")).toEqual({ label: "Failed", tone: "red" });
  expect(describeReason("conditions_not_met")).toBe("Conditions were not met");
  expect(describeReason("loop_protection_depth")).toBe(
    "Stopped: automations triggered by automations are followed only one step"
  );
  expect(describeReason("loop_protection_self")).toBe(
    "Stopped: a rule does not react to its own change"
  );
  expect(describeReason("rate_limited")).toBe(
    "Skipped: this rule already ran on this task several times recently"
  );
  expect(describeReason("action_blocked:set_status")).toBe(
    "This task cannot take the set status action"
  );
  expect(describeReason("task_archived")).toBe("The task is archived");
  expect(
    describeReason("assign: that person is not an active team member")
  ).toBe("assign: that person is not an active team member");
  expect(describeReason(null)).toBe("");
});
