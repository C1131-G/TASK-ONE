import { randomUUID } from "node:crypto";

import { authPool } from "./action-harness";

export interface SeededNotification {
  readonly actorId?: string | null;
  readonly createdAt?: Date;
  readonly projectId?: string | null;
  readonly readAt?: Date | null;
  readonly snippet?: string | null;
  readonly targetId?: string | null;
  readonly targetType?: "task" | "bug" | "approval" | null;
  readonly taskId?: string | null;
  readonly text?: string;
  readonly type?: string;
  readonly userId: string;
}

export const seedNotification = async (
  notification: SeededNotification
): Promise<string> => {
  const id = randomUUID();
  await authPool.query(
    'INSERT INTO notification (id, "userId", "actorId", "taskId", "projectId", "targetType", "targetId", type, text, snippet, "readAt", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
    [
      id,
      notification.userId,
      notification.actorId ?? null,
      notification.taskId ?? null,
      notification.projectId ?? null,
      notification.targetType ?? null,
      notification.targetId ?? null,
      notification.type ?? "mention",
      notification.text ?? `Notification ${id.slice(0, 8)}`,
      notification.snippet ?? null,
      notification.readAt ?? null,
      notification.createdAt ?? new Date(),
    ]
  );
  return id;
};

export interface RouteReply<Data = unknown> {
  readonly body: {
    readonly data: Data;
    readonly error: { readonly code: string; readonly message: string };
    readonly ok: boolean;
  };
  readonly status: number;
}

type Params = Record<string, string>;

type Handler<Context extends Params> = (
  request: Request,
  context: { params: Promise<Context> }
) => Promise<Response>;

export interface RouteCall<Context extends Params = Params> {
  readonly body?: unknown;
  readonly key?: string | null;
  readonly params?: Context;
  readonly query?: Record<string, string>;
  readonly token?: string;
}

// Calls a route handler the way Next does: a Request carrying a bearer token
// and a promise of the path parameters.
export const callRoute = async <Data = unknown>(
  handler: Handler<Params>,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  call: RouteCall = {}
): Promise<RouteReply<Data>> => {
  const url = new URL(`http://localhost:3000${path}`);
  for (const [name, value] of Object.entries(call.query ?? {})) {
    url.searchParams.set(name, value);
  }
  const headers: Record<string, string> = {};
  if (call.token) {
    headers["authorization"] = `Bearer ${call.token}`;
  }
  if (method !== "GET") {
    headers["content-type"] = "application/json";
    if (call.key !== null) {
      headers["idempotency-key"] = call.key ?? `mobile-key-${randomUUID()}`;
    }
  }
  const init: RequestInit = { headers, method };
  if (method !== "GET" && call.body !== undefined) {
    init.body = JSON.stringify(call.body);
  }
  const response = await handler(new Request(url, init), {
    params: Promise.resolve(call.params ?? {}),
  });
  return {
    body: (await response.json()) as RouteReply<Data>["body"],
    status: response.status,
  };
};

export const notificationRows = async (
  userId: string
): Promise<
  readonly {
    id: string;
    readAt: Date | null;
    targetId: string | null;
    targetType: string | null;
  }[]
> => {
  const result = await authPool.query<{
    id: string;
    readAt: Date | null;
    targetId: string | null;
    targetType: string | null;
  }>(
    'SELECT id, "readAt", "targetId", "targetType" FROM notification WHERE "userId" = $1 ORDER BY id',
    [userId]
  );
  return result.rows;
};

export interface OpenFixture {
  readonly approvalId: string;
  readonly bugId: string;
  readonly bugTaskId: string;
  readonly internalTaskId: string;
  readonly otherBugId: string;
  readonly projectId: string;
  readonly staffTaskId: string;
}

// A project shared with both harness companies: a bug and a request of the
// first company, a bug of the second, an internal task and a staff task.
export const seedOpenFixture = async (
  companyId: string,
  otherCompanyId: string,
  createdById: string
): Promise<OpenFixture> => {
  const fixture: OpenFixture = {
    approvalId: randomUUID(),
    bugId: randomUUID(),
    bugTaskId: randomUUID(),
    internalTaskId: randomUUID(),
    otherBugId: randomUUID(),
    projectId: randomUUID(),
    staffTaskId: randomUUID(),
  };
  const otherBugTaskId = randomUUID();
  const approvalTaskId = randomUUID();
  await authPool.query(
    'INSERT INTO project (id, key, name, "clientVisible") VALUES ($1, $2, $3, true)',
    [
      fixture.projectId,
      `OP${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`,
      "Open target project",
    ]
  );
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3), ($4, $5, $3)',
    [randomUUID(), companyId, fixture.projectId, randomUUID(), otherCompanyId]
  );
  await authPool.query(
    `INSERT INTO task (id, "projectId", "projectTaskNumber", title, "clientVisible", "createdById") VALUES
      ($1, $2, 1, 'Client bug task', true, $3),
      ($4, $2, 2, 'Other client bug task', true, $3),
      ($5, $2, 3, 'Internal task', false, $3),
      ($6, $2, 4, 'Approval task', true, $3),
      ($7, $2, 5, 'Staff task', false, $3)`,
    [
      fixture.bugTaskId,
      fixture.projectId,
      createdById,
      otherBugTaskId,
      fixture.internalTaskId,
      approvalTaskId,
      fixture.staffTaskId,
    ]
  );
  await authPool.query(
    `INSERT INTO bug_report (id, "taskId", "projectId", "reporterId", severity, "discoverySource", environment, component, route, "expectedBehavior", "actualBehavior", "reproductionSteps", "clientCompanyId", "clientImpact") VALUES
      ($1, $2, $3, $4, 'minor', 'customer_report', 'production', 'Client report', '/page', 'It works', 'It breaks', ARRAY['Open it'], $5, 'medium'),
      ($6, $7, $3, $4, 'minor', 'customer_report', 'production', 'Client report', '/page', 'It works', 'It breaks', ARRAY['Open it'], $8, 'medium')`,
    [
      fixture.bugId,
      fixture.bugTaskId,
      fixture.projectId,
      createdById,
      companyId,
      fixture.otherBugId,
      otherBugTaskId,
      otherCompanyId,
    ]
  );
  await authPool.query(
    `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, status, "requestedById", "requestedAt") VALUES
      ($1, $2, $3, $4, $5, 'Design sign-off', 1, 'Please review', 'pending', $6, now())`,
    [
      fixture.approvalId,
      fixture.projectId,
      companyId,
      approvalTaskId,
      `task:${approvalTaskId}`,
      createdById,
    ]
  );
  return fixture;
};
