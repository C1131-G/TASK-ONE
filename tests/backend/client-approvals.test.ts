import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  callAsWithCookie,
  createPersona,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionResultLike } from "./support/action-harness";

const staff = await import("../../features/approvals/approval-actions");
const staffQueries = await import("../../features/approvals/approval-queries");
const portal = await import("../../features/portal/portal-approval-actions");
const portalQueries =
  await import("../../features/portal/portal-approval-queries");
const portalFiles = await import("../../features/portal/portal-upload-actions");

const SECRET_COMMENT = "Internal note: approval is a formality";
const SECRET_FILE_NAME = "internal-costing.xlsx";

const suffix = randomUUID().slice(0, 6).toUpperCase();
const fixture = {
  hiddenFileId: randomUUID(),
  milestoneFileId: randomUUID(),
  milestoneId: randomUUID(),
  otherFileId: randomUUID(),
  otherProjectId: randomUUID(),
  otherProjectTaskId: randomUUID(),
  otherTaskFileId: randomUUID(),
  projectId: randomUUID(),
  sharedFileA: randomUUID(),
  sharedFileB: randomUUID(),
  sharedTaskId: randomUUID(),
  unsharedFileId: randomUUID(),
  unsharedTaskId: randomUUID(),
};
let deactivatedClient = { cookie: "", id: "" };

const insertFile = async (
  id: string,
  projectId: string,
  taskId: string | null,
  name: string,
  uploader: string
) => {
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, \'application/pdf\', 10)',
    [id, projectId, taskId, uploader, name, `approvals/${id}/${name}`]
  );
};

beforeAll(async () => {
  await setupHarness();
  const owner = personaId("owner");
  await authPool.query(
    'INSERT INTO project (id, key, name, "clientVisible") VALUES ($1, $2, $3, true), ($4, $5, $6, true)',
    [
      fixture.projectId,
      `AP${suffix}`,
      "Harness approvals project",
      fixture.otherProjectId,
      `AQ${suffix}`,
      "Harness approvals other project",
    ]
  );
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3), ($4, $5, $6)',
    [
      randomUUID(),
      ids.clientCompanyId,
      fixture.projectId,
      randomUUID(),
      ids.otherClientCompanyId,
      fixture.otherProjectId,
    ]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "clientVisible", "createdById") VALUES ($1, $2, 1, $3, true, $4), ($5, $2, 2, $6, false, $4), ($7, $8, 1, $9, true, $4)',
    [
      fixture.sharedTaskId,
      fixture.projectId,
      "Logo concepts",
      owner,
      fixture.unsharedTaskId,
      "Unshared staff task",
      fixture.otherProjectTaskId,
      fixture.otherProjectId,
      "Other company task",
    ]
  );
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2)',
    [fixture.sharedTaskId, owner]
  );
  await authPool.query(
    'INSERT INTO comment (id, "taskId", "authorId", body, visibility) VALUES ($1, $2, $3, $4, \'internal\')',
    [randomUUID(), fixture.sharedTaskId, owner, SECRET_COMMENT]
  );
  await authPool.query(
    "INSERT INTO project_milestone (id, \"projectId\", name, position) VALUES ($1, $2, 'Brand kit delivered', 0)",
    [fixture.milestoneId, fixture.projectId]
  );
  await insertFile(
    fixture.sharedFileA,
    fixture.projectId,
    fixture.sharedTaskId,
    "logo-a.pdf",
    owner
  );
  await insertFile(
    fixture.sharedFileB,
    fixture.projectId,
    fixture.sharedTaskId,
    "logo-b.pdf",
    owner
  );
  await insertFile(
    fixture.hiddenFileId,
    fixture.projectId,
    fixture.sharedTaskId,
    SECRET_FILE_NAME,
    owner
  );
  await insertFile(
    fixture.unsharedFileId,
    fixture.projectId,
    fixture.unsharedTaskId,
    "unshared.pdf",
    owner
  );
  await insertFile(
    fixture.milestoneFileId,
    fixture.projectId,
    null,
    "brand-kit.pdf",
    owner
  );
  await insertFile(
    fixture.otherTaskFileId,
    fixture.otherProjectId,
    fixture.otherProjectTaskId,
    "other.pdf",
    owner
  );
  const dead = await createPersona("employee", "deadclient");
  await authPool.query(
    'UPDATE "user" SET role = \'client\', "clientCompanyId" = $2, "mustChangePassword" = false WHERE id = $1',
    [dead.id, ids.clientCompanyId]
  );
  deactivatedClient = { cookie: dead.headers.get("cookie") ?? "", id: dead.id };
});
afterAll(teardownHarness);

const okData = <Data>(result: ActionResultLike): Data => {
  if (!result.ok) {
    throw new Error(
      `Unexpected failure: ${result.error.code} ${result.error.message}`
    );
  }
  return result.data as Data;
};
const refused = (result: ActionResultLike, ...codes: string[]) =>
  !result.ok && codes.includes(result.error.code);

interface Receipt {
  readonly id: string;
  readonly version: number;
}

const request = async (
  overrides: Record<string, unknown> = {},
  persona: "owner" | "admin" | "outsider" | "client" = "owner"
) =>
  await callAs(persona, staff.requestApprovalAction, {
    companyId: ids.clientCompanyId,
    fileIds: [fixture.sharedFileA],
    idempotencyKey: nextKey(),
    message: "Please review the logo concepts.",
    taskId: fixture.sharedTaskId,
    ...overrides,
  });

const decide = async (
  persona: "client" | "coworker" | "otherClient" | "owner",
  requestId: string,
  decision: "approve" | "request_changes",
  comment = ""
) =>
  await callAs(persona, portal.decideApprovalAction, {
    comment,
    decision,
    idempotencyKey: nextKey(),
    requestId,
  });

const clear = async () => {
  await authPool.query(
    'DELETE FROM notification WHERE "userId" = ANY($1::text[])',
    [[personaId("owner"), personaId("client"), personaId("coworker")]]
  );
  await authPool.query(
    'DELETE FROM approval_request WHERE "projectId" IN ($1, $2)',
    [fixture.projectId, fixture.otherProjectId]
  );
};

const statusOf = async (requestId: string) => {
  const found = await authPool.query<{ status: string }>(
    "SELECT status FROM approval_request WHERE id = $1",
    [requestId]
  );
  return found.rows[0]?.status;
};

const open = async (persona: "client" | "otherClient", fileId: string) =>
  await callAs(persona, portalFiles.getPortalFileUrlAction, {
    disposition: "download",
    fileId,
  });

it("lets staff request approval of a shared task and the client sees it", async () => {
  await clear();
  const receipt = okData<Receipt>(await request());
  expect(receipt.version).toBe(1);
  const listed = okData<readonly Record<string, unknown>[]>(
    await callAs("client", portalQueries.listPortalApprovals, {})
  );
  expect(listed).toHaveLength(1);
  expect(listed[0]).toMatchObject({
    id: receipt.id,
    status: "pending",
    subjectTitle: "Logo concepts",
    version: 1,
  });
  expect(
    okData<number>(
      await callAs("client", portalQueries.getPortalApprovalCount, {})
    )
  ).toBe(1);
  expect(
    okData<number>(
      await callAs("coworker", portalQueries.getPortalApprovalCount, {})
    )
  ).toBe(1);
  expect(
    okData<number>(
      await callAs("otherClient", portalQueries.getPortalApprovalCount, {})
    )
  ).toBe(0);
});

it("notifies the company's clients about a new request", async () => {
  await clear();
  const receipt = okData<Receipt>(await request());
  const rows = await authPool.query<{ type: string; userId: string }>(
    'SELECT type, "userId" FROM notification WHERE text LIKE \'Approval requested%\' AND "userId" = ANY($1::text[])',
    [[personaId("client"), personaId("coworker")]]
  );
  expect(rows.rows.map(({ userId }) => userId).toSorted()).toEqual(
    [personaId("client"), personaId("coworker")].toSorted()
  );
  expect(receipt.version).toBe(1);
});

it("refuses requests for work the client cannot see", async () => {
  await clear();
  expect(
    refused(
      await request({
        fileIds: [fixture.unsharedFileId],
        taskId: fixture.unsharedTaskId,
      }),
      "VALIDATION_FAILED",
      "FORBIDDEN"
    )
  ).toBe(true);
  expect(
    refused(
      await request({
        companyId: ids.otherClientCompanyId,
      }),
      "VALIDATION_FAILED",
      "FORBIDDEN",
      "NOT_FOUND"
    )
  ).toBe(true);
  expect(
    refused(
      await request({
        fileIds: [fixture.otherTaskFileId],
      }),
      "VALIDATION_FAILED",
      "NOT_FOUND"
    )
  ).toBe(true);
  expect(refused(await request({ fileIds: [] }), "VALIDATION_FAILED")).toBe(
    true
  );
  expect(refused(await request({ message: "   " }), "VALIDATION_FAILED")).toBe(
    true
  );
  const rows = await authPool.query(
    'SELECT 1 FROM approval_request WHERE "projectId" = $1',
    [fixture.projectId]
  );
  expect(rows.rowCount).toBe(0);
});

it("refuses clients and people who cannot edit the task", async () => {
  await clear();
  expect(refused(await request({}, "client"), "FORBIDDEN")).toBe(true);
  expect(refused(await request({}, "outsider"), "FORBIDDEN")).toBe(true);
  expect(okData<Receipt>(await request({}, "admin")).version).toBe(1);
});

it("supports a project milestone as the subject, for administrators", async () => {
  await clear();
  const receipt = okData<Receipt>(
    await request(
      {
        fileIds: [fixture.milestoneFileId],
        milestoneId: fixture.milestoneId,
        taskId: undefined,
      },
      "admin"
    )
  );
  const listed = okData<readonly Record<string, unknown>[]>(
    await callAs("client", portalQueries.listPortalApprovals, {})
  );
  expect(listed.find(({ id }) => id === receipt.id)).toMatchObject({
    subjectKind: "milestone",
    subjectTitle: "Brand kit delivered",
  });
  // A standalone project file opens for the client only through this request.
  expect(await open("client", fixture.milestoneFileId)).toMatchObject({
    ok: true,
  });
  expect(
    refused(await open("otherClient", fixture.milestoneFileId), "NOT_FOUND")
  ).toBe(true);
  expect(
    refused(
      await request({ milestoneId: fixture.milestoneId, taskId: undefined }),
      "FORBIDDEN"
    )
  ).toBe(true);
});

it("records an approval once with who and when, and keeps it immutable", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  const first = await decide("client", id, "approve", "Looks great");
  expect(okData<{ status: string }>(first).status).toBe("approved");
  const row = await authPool.query<{
    decidedAt: Date | null;
    decidedById: string | null;
    decisionComment: string | null;
  }>(
    'SELECT "decidedAt", "decidedById", "decisionComment" FROM approval_request WHERE id = $1',
    [id]
  );
  expect(row.rows[0]?.decidedById).toBe(personaId("client"));
  expect(row.rows[0]?.decidedAt).toBeInstanceOf(Date);
  expect(row.rows[0]?.decisionComment).toBe("Looks great");
  // The same person repeating the same decision is a no-op, not a failure.
  expect(
    okData<{ status: string }>(await decide("client", id, "approve")).status
  ).toBe("approved");
  // Nobody can flip it, including a colleague.
  expect(
    refused(await decide("client", id, "request_changes", "No"), "CONFLICT")
  ).toBe(true);
  expect(refused(await decide("coworker", id, "approve"), "CONFLICT")).toBe(
    true
  );
  expect(await statusOf(id)).toBe("approved");
  const notified = await authPool.query(
    "SELECT 1 FROM notification WHERE \"userId\" = $1 AND text LIKE '%approved%'",
    [personaId("owner")]
  );
  expect(notified.rowCount).toBe(1);
});

it("requires a comment to request changes and notifies staff", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  expect(
    refused(
      await decide("client", id, "request_changes", "   "),
      "VALIDATION_FAILED"
    )
  ).toBe(true);
  expect(await statusOf(id)).toBe("pending");
  const result = await decide(
    "coworker",
    id,
    "request_changes",
    "Make it bigger"
  );
  expect(okData<{ status: string }>(result).status).toBe("changes_requested");
  const notified = await authPool.query(
    "SELECT snippet FROM notification WHERE \"userId\" = $1 AND text LIKE '%requested changes%'",
    [personaId("owner")]
  );
  expect(notified.rows[0]).toMatchObject({ snippet: "Make it bigger" });
});

it("lets exactly one of two racing decisions win", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  const results = await Promise.all([
    decide("client", id, "approve"),
    decide("coworker", id, "request_changes", "Not yet"),
  ]);
  expect(results.filter(({ ok }) => ok)).toHaveLength(1);
  expect(results.filter((result) => refused(result, "CONFLICT"))).toHaveLength(
    1
  );
});

it("refuses other companies and signed-out visitors on every record", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  expect(refused(await decide("otherClient", id, "approve"), "NOT_FOUND")).toBe(
    true
  );
  expect(
    refused(
      await callAs("otherClient", portalQueries.getPortalApproval, {
        approvalId: id,
      }),
      "NOT_FOUND"
    )
  ).toBe(true);
  expect(refused(await decide("owner", id, "approve"), "FORBIDDEN")).toBe(true);
  expect(
    refused(
      await callAs("anonymous" as never, portal.decideApprovalAction, {
        comment: "",
        decision: "approve",
        idempotencyKey: nextKey(),
        requestId: id,
      }),
      "UNAUTHENTICATED"
    )
  ).toBe(true);
  expect(await statusOf(id)).toBe("pending");
});

it("refuses a deactivated client", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  await authPool.query(
    'UPDATE "user" SET "deactivatedAt" = now(), "deactivatedById" = $2 WHERE id = $1',
    [deactivatedClient.id, personaId("admin")]
  );
  const asDeactivated = async (
    action: (input: unknown) => Promise<ActionResultLike>,
    input: unknown
  ) =>
    await callAsWithCookie(
      "anonymous",
      deactivatedClient.cookie,
      action,
      input
    );
  expect(
    refused(
      await asDeactivated(portal.decideApprovalAction, {
        comment: "",
        decision: "approve",
        idempotencyKey: nextKey(),
        requestId: id,
      }),
      "UNAUTHENTICATED"
    )
  ).toBe(true);
  expect(
    refused(
      await asDeactivated(portalQueries.listPortalApprovals, {}),
      "UNAUTHENTICATED"
    )
  ).toBe(true);
  expect(await statusOf(id)).toBe("pending");
});

it("keeps decisions out of reach once the request is cancelled", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  okData(
    await callAs("owner", staff.cancelApprovalAction, {
      idempotencyKey: nextKey(),
      requestId: id,
    })
  );
  expect(await statusOf(id)).toBe("cancelled");
  expect(
    refused(await decide("client", id, "approve"), "CONFLICT", "NOT_FOUND")
  ).toBe(true);
  expect(await statusOf(id)).toBe("cancelled");
  const listed = okData<readonly unknown[]>(
    await callAs("client", portalQueries.listPortalApprovals, {})
  );
  expect(JSON.stringify(listed)).not.toContain(id);
});

it("cannot cancel a decided request or cancel as someone else", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  expect(
    refused(
      await callAs("outsider", staff.cancelApprovalAction, {
        idempotencyKey: nextKey(),
        requestId: id,
      }),
      "FORBIDDEN"
    )
  ).toBe(true);
  okData(await decide("client", id, "approve"));
  expect(
    refused(
      await callAs("owner", staff.cancelApprovalAction, {
        idempotencyKey: nextKey(),
        requestId: id,
      }),
      "CONFLICT"
    )
  ).toBe(true);
  expect(await statusOf(id)).toBe("approved");
});

it("allows a new version after changes were requested and keeps the old one", async () => {
  await clear();
  const first = okData<Receipt>(await request());
  expect(refused(await request(), "CONFLICT")).toBe(true);
  okData(
    await decide("client", first.id, "request_changes", "Fix the colours")
  );
  const second = okData<Receipt>(
    await request({ fileIds: [fixture.sharedFileB], message: "Updated" })
  );
  expect(second.version).toBe(2);
  expect(await statusOf(first.id)).toBe("changes_requested");
  expect(await statusOf(second.id)).toBe("pending");
  const detail = okData<{
    history: readonly { version: number; status: string }[];
  }>(
    await callAs("client", portalQueries.getPortalApproval, {
      approvalId: second.id,
    })
  );
  expect(detail.history).toEqual([
    expect.objectContaining({ status: "changes_requested", version: 1 }),
  ]);
  const staffView = okData<{ requests: readonly { version: number }[] }>(
    await callAs("owner", staffQueries.listTaskApprovals, {
      taskId: fixture.sharedTaskId,
    })
  );
  expect(staffView.requests.map(({ version }) => version).toSorted()).toEqual([
    1, 2,
  ]);
  // A decided earlier version is read-only.
  expect(refused(await decide("client", first.id, "approve"), "CONFLICT")).toBe(
    true
  );
  okData(await decide("client", second.id, "approve"));
  expect(refused(await request(), "CONFLICT")).toBe(true);
});

it("opens only the request's own files through the signed download flow", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  const detail = okData<{ files: readonly { fileId: string }[] }>(
    await callAs("client", portalQueries.getPortalApproval, { approvalId: id })
  );
  expect(detail.files.map(({ fileId }) => fileId)).toEqual([
    fixture.sharedFileA,
  ]);
  // Same task, not on the request.
  expect(refused(await open("client", fixture.sharedFileB), "NOT_FOUND")).toBe(
    true
  );
  expect(refused(await open("client", fixture.hiddenFileId), "NOT_FOUND")).toBe(
    true
  );
  // Another company's client cannot open the request's file.
  expect(
    refused(await open("otherClient", fixture.sharedFileA), "NOT_FOUND")
  ).toBe(true);
  await authPool.query(
    'UPDATE approval_request SET status = \'cancelled\', "cancelledById" = $2, "cancelledAt" = now() WHERE id = $1',
    [id, personaId("owner")]
  );
  expect(refused(await open("client", fixture.sharedFileA), "NOT_FOUND")).toBe(
    true
  );
});

it("hides a request when the task is unshared or the project is taken off the company", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  const visible = async () =>
    JSON.stringify(
      okData(await callAs("client", portalQueries.listPortalApprovals, {}))
    ).includes(id);
  expect(await visible()).toBe(true);
  await authPool.query(
    'UPDATE task SET "clientVisible" = false WHERE id = $1',
    [fixture.sharedTaskId]
  );
  expect(await visible()).toBe(false);
  expect(refused(await decide("client", id, "approve"), "NOT_FOUND")).toBe(
    true
  );
  await authPool.query('UPDATE task SET "clientVisible" = true WHERE id = $1', [
    fixture.sharedTaskId,
  ]);
  await authPool.query(
    'UPDATE client_company_project SET "removedAt" = now() WHERE "projectId" = $1',
    [fixture.projectId]
  );
  expect(await visible()).toBe(false);
  await authPool.query(
    'UPDATE client_company_project SET "removedAt" = null WHERE "projectId" = $1',
    [fixture.projectId]
  );
});

it("never exposes internal comments, staff-only files or other work to the client", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  const everything = JSON.stringify([
    okData(await callAs("client", portalQueries.listPortalApprovals, {})),
    okData(
      await callAs("client", portalQueries.getPortalApproval, {
        approvalId: id,
      })
    ),
  ]);
  for (const secret of [
    SECRET_COMMENT,
    SECRET_FILE_NAME,
    fixture.hiddenFileId,
    fixture.unsharedTaskId,
    "Unshared staff task",
    personaId("owner"),
    "logo-b.pdf",
  ]) {
    expect(everything.includes(secret), secret).toBe(false);
  }
});

it("shows staff the history with who decided and when", async () => {
  await clear();
  const { id } = okData<Receipt>(await request());
  okData(await decide("client", id, "approve", "Great"));
  const view = okData<{
    companies: readonly { id: string }[];
    requests: readonly Record<string, unknown>[];
  }>(
    await callAs("owner", staffQueries.listTaskApprovals, {
      taskId: fixture.sharedTaskId,
    })
  );
  expect(view.companies.map(({ id: companyId }) => companyId)).toContain(
    ids.clientCompanyId
  );
  expect(view.requests[0]).toMatchObject({
    decidedByName: "Harness client",
    decisionComment: "Great",
    status: "approved",
    version: 1,
  });
  expect(
    refused(
      await callAs("client", staffQueries.listTaskApprovals, {
        taskId: fixture.sharedTaskId,
      }),
      "FORBIDDEN"
    )
  ).toBe(true);
  await clear();
});
