import { expect, it } from "bun:test";

import {
  hasRequiredBugEvidence,
  transitionBugStatus,
} from "../../src/server/work/bug-workflow";

it("uses report-level before evidence with the current attempt's after evidence", () => {
  expect(
    hasRequiredBugEvidence(
      [
        { fixAttemptId: null, kind: "before" },
        { fixAttemptId: "attempt-current", kind: "after" },
        { fixAttemptId: "attempt-old", kind: "before" },
      ],
      "attempt-current"
    )
  ).toBe(true);
});

it("allows an assigned employee to begin investigating a triaged bug", () => {
  expect(
    transitionBugStatus({
      actorRole: "employee",
      currentStatus: "triaged",
      nextStatus: "in_progress",
    })
  ).toBe("in_progress");
});

it("rejects release closure until a post-release check is recorded", () => {
  expect(() =>
    transitionBugStatus({
      actorRole: "admin",
      currentStatus: "released",
      hasSuccessfulPostReleaseCheck: false,
      nextStatus: "closed",
    })
  ).toThrow("A successful post-release check is required before closing.");
});

it("allows an admin to close a released bug after a successful post-release check", () => {
  expect(
    transitionBugStatus({
      actorRole: "admin",
      currentStatus: "released",
      hasSuccessfulPostReleaseCheck: true,
      nextStatus: "closed",
    })
  ).toBe("closed");
});

it("allows only an admin to reopen a closed bug", () => {
  expect(() =>
    transitionBugStatus({
      actorRole: "employee",
      currentStatus: "closed",
      nextStatus: "in_progress",
    })
  ).toThrow("Only admins can reopen a closed bug.");
});

it("does not allow an employee to approve a bug for release", () => {
  expect(() =>
    transitionBugStatus({
      actorRole: "employee",
      currentStatus: "awaiting_admin_approval",
      nextStatus: "approved_for_release",
    })
  ).toThrow("Only admins can approve bugs for release.");
});

it("requires successful verification before approval submission", () => {
  expect(() =>
    transitionBugStatus({
      actorRole: "employee",
      currentStatus: "in_progress",
      nextStatus: "awaiting_admin_approval",
    })
  ).toThrow("A verified fix with before and after evidence is required.");
});
