import { expect, it } from "bun:test";

import { db } from "../../src/prisma/db";
import {
  BUG_STATUSES,
  canMoveBug,
} from "../../src/server/work/bug-status-edges";
import { updateBugStatus } from "../../src/server/work/bug-workflow-internal";
import {
  force,
  installHooks,
  pick,
  state,
  submit,
} from "./support/client-lifecycle-fixtures";

installHooks();

// Every move a bug may make, written out once. The moves come from the
// workflow actions themselves: triage, investigation, the client's answer or
// verification, approval, release, withdrawal and the admin's reopen. A move
// that is not here is a bug in the caller, not a workflow step.
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  approved_for_release: ["released"],
  awaiting_admin_approval: ["approved_for_release", "rejected"],
  awaiting_client: ["closed", "triaged", "reported", "in_progress"],
  closed: ["in_progress"],
  duplicate: ["awaiting_client"],
  in_progress: [
    "in_progress",
    "in_verification",
    "awaiting_admin_approval",
    "needs_info",
    "closed",
  ],
  in_verification: ["in_progress", "awaiting_admin_approval", "needs_info"],
  needs_info: ["triaged", "in_progress", "in_verification", "closed"],
  rejected: ["in_progress"],
  released: ["closed", "awaiting_client"],
  reported: ["triaged", "duplicate", "withdrawn", "closed"],
  triaged: ["in_progress", "duplicate", "needs_info", "closed"],
  withdrawn: [],
};

it("names all thirteen statuses", () => {
  const known: string[] = [...BUG_STATUSES];

  expect(known.toSorted()).toEqual(Object.keys(ALLOWED).toSorted());
  expect(known).toHaveLength(13);
});

it("allows exactly the listed moves, out of all 169 pairs", () => {
  const wrong: string[] = [];
  for (const from of BUG_STATUSES) {
    for (const to of BUG_STATUSES) {
      const expected = ALLOWED[from]?.includes(to) ?? false;
      if (canMoveBug(from, to) !== expected) {
        wrong.push(
          `${from} -> ${to} should be ${expected ? "allowed" : "refused"}`
        );
      }
    }
  }

  expect(wrong).toEqual([]);
});

it("refuses a move the workflow has no step for, and leaves the bug alone", async () => {
  const bugId = await submit("Closed stays closed");
  await pick(bugId);
  await force(bugId, "closed", {
    awaitingClientSince: null,
    resolution: "fixed",
  });
  const before = await state(bugId);
  const row = await db.orm.public.BugReport.where({ id: bugId }).first();
  if (!row) {
    throw new Error("bug missing");
  }

  const attempt = db.transaction((transaction) =>
    updateBugStatus(transaction, {
      actorId: row.reporterId,
      bug: row,
      nextStatus: "awaiting_client",
      now: new Date(),
    })
  );

  await expect(attempt).rejects.toMatchObject({ code: "CONFLICT" });
  expect(await state(bugId)).toEqual(before);
});
