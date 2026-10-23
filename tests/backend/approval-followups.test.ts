import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionResultLike } from "./support/action-harness";

const staff = await import("../../features/approvals/approval-actions");
const staffQueries = await import("../../features/approvals/approval-queries");
const portalQueries = await import("../../features/portal/portal-queries");
const { decideApprovalAction: portalDecide } =
  await import("../../features/portal/portal-approval-actions");

const suffix = randomUUID().slice(0, 6).toUpperCase();
const fixture = {
  fileId: randomUUID(),
  milestoneId: randomUUID(),
  otherFileId: randomUUID(),
  otherMilestoneId: randomUUID(),
  otherProjectId: randomUUID(),
  projectId: randomUUID(),
  taskFileId: randomUUID(),
  taskId: randomUUID(),
};

const insertFile = async (
  id: string,
  projectId: string,
  taskId: string | null,
  name: string
) => {
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, \'application/pdf\', 10)',
    [id, projectId, taskId, personaId("owner"), name, `followups/${id}/${name}`]
  );
};

beforeAll(async () => {
  await setupHarness();
  await authPool.query(
    'INSERT INTO project (id, key, name, "clientVisible") VALUES ($1, $2, $3, true), ($4, $5, $6, true)',
    [
      fixture.projectId,
      `FA${suffix}`,
      "Harness followups project",
      fixture.otherProjectId,
      `FB${suffix}`,
      "Harness followups other project",
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
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "clientVisible", "createdById") VALUES ($1, $2, 1, $3, true, $4)',
    [fixture.taskId, fixture.projectId, "Followup task", personaId("owner")]
  );
  await authPool.query(
    "INSERT INTO project_milestone (id, \"projectId\", name, position) VALUES ($1, $2, 'Followup launch', 0), ($3, $4, 'Other launch', 0)",
    [
      fixture.milestoneId,
      fixture.projectId,
      fixture.otherMilestoneId,
      fixture.otherProjectId,
    ]
  );
  await insertFile(fixture.fileId, fixture.projectId, null, "launch.pdf");
  await insertFile(
    fixture.taskFileId,
    fixture.projectId,
    fixture.taskId,
    "task.pdf"
  );
  await insertFile(
    fixture.otherFileId,
    fixture.otherProjectId,
    null,
    "other.pdf"
  );
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

const requestMilestone = async (
  overrides: Record<string, unknown> = {},
  persona: "admin" | "owner" = "admin"
) =>
  await callAs(persona, staff.requestApprovalAction, {
    companyId: ids.clientCompanyId,
    fileIds: [fixture.fileId],
    idempotencyKey: nextKey(),
    message: "Please review the launch.",
    milestoneId: fixture.milestoneId,
    ...overrides,
  });

const clear = async () => {
  await authPool.query(
    'DELETE FROM notification WHERE "userId" = ANY($1::text[])',
    [[personaId("client"), personaId("coworker"), personaId("otherClient")]]
  );
  await authPool.query(
    'DELETE FROM approval_request WHERE "projectId" IN ($1, $2)',
    [fixture.projectId, fixture.otherProjectId]
  );
};

interface NotificationItem {
  readonly approvalId: string | null;
  readonly text: string;
}

const notificationsOf = async (persona: "client" | "otherClient") =>
  okData<{ readonly items: readonly NotificationItem[] }>(
    await callAs(persona, portalQueries.listPortalNotifications, {})
  ).items;

it("links a new approval request notification to the approval page", async () => {
  await clear();
  const { id } = okData<Receipt>(await requestMilestone());
  const items = await notificationsOf("client");
  expect(
    items.find(({ text }) => text.startsWith("Approval requested"))
  ).toMatchObject({ approvalId: id });
});

const approvalIdFor = async (
  persona: "client" | "otherClient",
  title: string
) => {
  const items = await notificationsOf(persona);
  return items.find(({ text }) => text.includes(title))?.approvalId;
};

const setProjectShared = async (shared: boolean) =>
  await authPool.query(
    'UPDATE project SET "clientVisible" = $2 WHERE id = $1',
    [fixture.projectId, shared]
  );

it("gives no link for a foreign company, an unshared project or a cancelled request", async () => {
  await clear();
  const { id } = okData<Receipt>(await requestMilestone());
  expect(await approvalIdFor("otherClient", "Followup launch")).toBeUndefined();
  await setProjectShared(false);
  expect(await approvalIdFor("client", "Followup launch")).toBeNull();
  await setProjectShared(true);
  expect(await approvalIdFor("client", "Followup launch")).toBe(id);
  okData(
    await callAs("admin", staff.cancelApprovalAction, {
      idempotencyKey: nextKey(),
      requestId: id,
    })
  );
  expect(await approvalIdFor("client", "Followup launch")).toBeNull();
});

it("links a re-request to its own version only", async () => {
  await clear();
  const first = okData<Receipt>(await requestMilestone());
  okData(
    await callAs("admin", staff.cancelApprovalAction, {
      idempotencyKey: nextKey(),
      requestId: first.id,
    })
  );
  const second = okData<Receipt>(await requestMilestone());
  const items = await notificationsOf("client");
  const idOf = (prefix: string) =>
    items.find(({ text }) => text.startsWith(prefix))?.approvalId;
  expect(idOf("Approval requested again")).toBe(second.id);
  expect(idOf("Approval requested:")).toBeNull();
});

interface ProjectRequest {
  readonly decidedAt: string | null;
  readonly decidedByName: string | null;
  readonly decisionComment: string | null;
  readonly id: string;
  readonly requestedByName: string;
  readonly status: string;
  readonly subjectKind: string;
  readonly subjectTitle: string;
  readonly version: number;
}

interface ProjectApprovals {
  readonly canRequest: boolean;
  readonly companies: readonly { readonly id: string }[];
  readonly files: readonly { readonly id: string }[];
  readonly milestones: readonly { readonly id: string }[];
  readonly requests: readonly ProjectRequest[];
}

const projectApprovals = async (
  persona: "admin" | "outsider" | "owner",
  projectId = fixture.projectId
) =>
  okData<ProjectApprovals>(
    await callAs(persona, staffQueries.listProjectApprovals, { projectId })
  );

const requestTask = async () =>
  await callAs("owner", staff.requestApprovalAction, {
    companyId: ids.clientCompanyId,
    fileIds: [fixture.taskFileId],
    idempotencyKey: nextKey(),
    message: "Please review the task.",
    taskId: fixture.taskId,
  });

it("lists every request of the project's tasks and milestones for staff", async () => {
  await clear();
  const milestone = okData<Receipt>(await requestMilestone());
  const task = okData<Receipt>(await requestTask());
  okData(
    await callAs("client", portalDecide, {
      comment: "Ship it",
      decision: "approve",
      idempotencyKey: nextKey(),
      requestId: milestone.id,
    })
  );
  const { requests } = await projectApprovals("outsider");
  expect(requests.map(({ id }) => id).toSorted()).toEqual(
    [milestone.id, task.id].toSorted()
  );
  expect(requests.find(({ id }) => id === milestone.id)).toMatchObject({
    decidedByName: expect.any(String),
    decisionComment: "Ship it",
    requestedByName: expect.any(String),
    status: "approved",
    subjectKind: "milestone",
    subjectTitle: "Followup launch",
    version: 1,
  });
  expect(requests.find(({ id }) => id === task.id)).toMatchObject({
    decidedAt: null,
    status: "pending",
    subjectKind: "task",
    subjectTitle: "Followup task",
  });
});

it("keeps other projects' requests out and refuses clients", async () => {
  await clear();
  okData<Receipt>(await requestMilestone());
  const other = await projectApprovals("admin", fixture.otherProjectId);
  expect(other.requests).toHaveLength(0);
  expect(
    refused(
      await callAs("client", staffQueries.listProjectApprovals, {
        projectId: fixture.projectId,
      }),
      "FORBIDDEN"
    )
  ).toBe(true);
  expect(
    refused(
      await callAs("anonymous", staffQueries.listProjectApprovals, {
        projectId: fixture.projectId,
      }),
      "UNAUTHENTICATED"
    )
  ).toBe(true);
  expect(
    refused(
      await callAs("admin", staffQueries.listProjectApprovals, {
        projectId: ids.random,
      }),
      "NOT_FOUND"
    )
  ).toBe(true);
});

it("offers the request form's choices to administrators only", async () => {
  await clear();
  const asAdmin = await projectApprovals("admin");
  expect(asAdmin.canRequest).toBe(true);
  expect(asAdmin.milestones.map(({ id }) => id)).toEqual([fixture.milestoneId]);
  expect(asAdmin.companies.map(({ id }) => id)).toEqual([ids.clientCompanyId]);
  expect(asAdmin.files.map(({ id }) => id).toSorted()).toEqual(
    [fixture.fileId, fixture.taskFileId].toSorted()
  );
  const asEmployee = await projectApprovals("owner");
  expect(asEmployee).toMatchObject({
    canRequest: false,
    companies: [],
    files: [],
    milestones: [],
  });
});
