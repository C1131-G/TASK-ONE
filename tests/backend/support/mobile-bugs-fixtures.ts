import { randomUUID } from "node:crypto";

import {
  authPool,
  ids,
  nextKey,
  personaBearerToken,
  personaId,
} from "./action-harness";
import type { Persona } from "./action-harness";

// Route handlers differ in the params they accept, so the context is typed per
// route and supplied here as plain text.
export type RouteHandler = (
  request: Request,
  context: never
) => Promise<Response>;

export interface Reply {
  readonly status: number;
  // The parsed JSON envelope: `{ ok, data | error, requestId }`.
  readonly body: {
    readonly ok: boolean;
    // oxlint-disable-next-line typescript/no-explicit-any -- Tests read many response shapes.
    readonly data: any;
    readonly error: {
      readonly code: string;
      readonly message: string;
      readonly fieldErrors?: Record<string, string>;
    };
  };
}

interface SendOptions {
  readonly body?: unknown;
  // `false` sends no Idempotency-Key header on a write.
  readonly key?: string | false;
  readonly params?: Record<string, string>;
  readonly query?: Record<string, string>;
  // Replaces the persona's own bearer token ("" sends none).
  readonly token?: string;
}

// Calls a route handler the way the app would: bearer token, JSON body and an
// Idempotency-Key on writes.
export const send = async (
  handler: RouteHandler,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  persona: Persona,
  options: SendOptions = {}
): Promise<Reply> => {
  const token = options.token ?? personaBearerToken(persona);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }
  if (method !== "GET" && options.key !== false) {
    headers["idempotency-key"] = options.key ?? nextKey();
  }
  const query = options.query
    ? `?${new URLSearchParams(options.query).toString()}`
    : "";
  const response = await handler(
    new Request(`http://localhost:3000/api/v1/test${query}`, {
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
      headers,
      method,
    }),
    { params: Promise.resolve(options.params ?? {}) } as never
  );
  return {
    body: (await response.json()) as Reply["body"],
    status: response.status,
  };
};

export const linkProjectToCompanies = async (): Promise<void> => {
  for (const companyId of [ids.clientCompanyId, ids.otherClientCompanyId]) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
      [randomUUID(), companyId, ids.projectId]
    );
  }
};

export const setHandlers = async (
  companyId: string,
  employees: readonly Persona[]
): Promise<void> => {
  await authPool.query(
    'DELETE FROM client_company_handler WHERE "companyId" = $1',
    [companyId]
  );
  for (const employee of employees) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      'INSERT INTO client_company_handler (id, "companyId", "employeeId", "assignedById") VALUES ($1, $2, $3, $4)',
      [randomUUID(), companyId, personaId(employee), personaId("admin")]
    );
  }
};

export const reportBody = (title = "Mobile report") => ({
  actualBehavior: "Broken",
  browser: null,
  description: null,
  device: null,
  expectedBehavior: "Works",
  impact: "medium",
  os: null,
  pageUrl: "/page",
  projectId: ids.projectId,
  reproductionSteps: ["Open it"],
  title,
});

export interface BugRow {
  readonly clientCompanyId: string | null;
  readonly pickedById: string | null;
  readonly status: string;
  readonly taskId: string;
  readonly version: number;
}

export const bugRow = async (bugId: string): Promise<BugRow> => {
  const result = await authPool.query<BugRow>(
    'SELECT "clientCompanyId", "pickedById", status, "taskId", version FROM bug_report WHERE id = $1',
    [bugId]
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error("bug missing");
  }
  return row;
};

export const countRows = async (
  table: string,
  where: string,
  values: readonly unknown[]
): Promise<number> => {
  const result = await authPool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${table} WHERE ${where}`,
    [...values]
  );
  return Number(result.rows[0]?.count ?? 0);
};
