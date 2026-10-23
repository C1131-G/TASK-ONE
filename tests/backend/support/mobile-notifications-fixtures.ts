import { randomUUID } from "node:crypto";

import { authPool } from "./action-harness";

export interface SeededNotification {
  readonly actorId?: string | null;
  readonly createdAt?: Date;
  readonly projectId?: string | null;
  readonly readAt?: Date | null;
  readonly snippet?: string | null;
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
    'INSERT INTO notification (id, "userId", "actorId", "taskId", "projectId", type, text, snippet, "readAt", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [
      id,
      notification.userId,
      notification.actorId ?? null,
      notification.taskId ?? null,
      notification.projectId ?? null,
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

type Handler = (
  request: Request,
  context: { params: Promise<Record<string, string>> }
) => Promise<Response>;

export interface RouteCall {
  readonly body?: unknown;
  readonly key?: string | null;
  readonly params?: Record<string, string>;
  readonly query?: Record<string, string>;
  readonly token?: string;
}

// Calls a route handler the way Next does: a Request carrying a bearer token
// and a promise of the path parameters.
export const callRoute = async <Data = unknown>(
  handler: Handler,
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
  readonly { id: string; readAt: Date | null; targetType?: string | null }[]
> => {
  const result = await authPool.query<{ id: string; readAt: Date | null }>(
    'SELECT id, "readAt" FROM notification WHERE "userId" = $1 ORDER BY id',
    [userId]
  );
  return result.rows;
};
