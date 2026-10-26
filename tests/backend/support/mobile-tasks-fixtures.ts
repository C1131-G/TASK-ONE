import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import type { RouteDefinition } from "../../../src/mobile-api/route-definition";
import { authPool, ids, personaBearerToken, personaId } from "./action-harness";
import type { Persona } from "./action-harness";

type RouteHandler = (request: Request, context: never) => Promise<Response>;
type RouteModule = Record<string, RouteHandler | undefined>;

// Each published path maps to the route file that serves it. Loading the file
// on demand keeps a test file importable before its route exists. A `:name`
// segment is a dynamic path parameter.
const ROUTES: readonly {
  readonly load: () => Promise<RouteModule>;
  readonly path: string;
}[] = [
  {
    load: () => import("../../../app/api/v1/workspace/me/work/route"),
    path: "/api/v1/workspace/me/work",
  },
  {
    load: () => import("../../../app/api/v1/workspace/tasks/route"),
    path: "/api/v1/workspace/tasks",
  },
  {
    load: () =>
      import("../../../app/api/v1/workspace/tasks/[taskId]/subtasks/route"),
    path: "/api/v1/workspace/tasks/:taskId/subtasks",
  },
  {
    load: () =>
      import("../../../app/api/v1/workspace/tasks/[taskId]/subtasks/[subtaskId]/route"),
    path: "/api/v1/workspace/tasks/:taskId/subtasks/:subtaskId",
  },
  {
    load: () =>
      import("../../../app/api/v1/workspace/tasks/[taskId]/subtasks/[subtaskId]/status/route"),
    path: "/api/v1/workspace/tasks/:taskId/subtasks/:subtaskId/status",
  },
  {
    load: () =>
      import("../../../app/api/v1/workspace/tasks/[taskId]/comments/route"),
    path: "/api/v1/workspace/tasks/:taskId/comments",
  },
  {
    load: () => import("../../../app/api/v1/workspace/tasks/[taskId]/route"),
    path: "/api/v1/workspace/tasks/:taskId",
  },
];

const matchRoute = (
  pathname: string
): { load: () => Promise<RouteModule>; params: Record<string, string> } => {
  const actual = pathname.split("/");
  for (const route of ROUTES) {
    const expected = route.path.split("/");
    const params: Record<string, string> = {};
    const matches =
      actual.length === expected.length &&
      expected.every((part, index) => {
        const segment = actual[index] ?? "";
        if (part.startsWith(":")) {
          params[part.slice(1)] = segment;
          return segment !== "";
        }
        return part === segment;
      });
    if (matches) {
      return { load: route.load, params };
    }
  }
  throw new Error(`No route is registered for ${pathname}`);
};

export interface ApiResponse<Data = unknown> {
  readonly status: number;
  readonly requestId: string | null;
  readonly body: {
    readonly ok: boolean;
    readonly data: Data;
    readonly error: {
      readonly code: string;
      readonly message: string;
      readonly fieldErrors?: Record<string, string>;
    };
  };
}

interface SendOptions {
  readonly as?: Persona;
  readonly body?: unknown;
  readonly key?: string;
  readonly token?: string;
}

// Calls a route handler the way the app does: a bearer token, a JSON body and
// an idempotency key on writes.
export const send = async <Data = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options: SendOptions = {}
): Promise<ApiResponse<Data>> => {
  const [pathname] = path.split("?");
  const route = matchRoute(pathname ?? "");
  const token =
    options.token ?? (options.as ? personaBearerToken(options.as) : "");
  const headers = new Headers();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  if (options.key) {
    headers.set("idempotency-key", options.key);
  }
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  const routeModule = await route.load();
  const handler = routeModule[method];
  if (!handler) {
    throw new Error(`${method} is not exported for ${path}`);
  }
  const response = await handler(
    new Request(`http://localhost:3000${path}`, {
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
      headers,
      method,
    }),
    { params: Promise.resolve(route.params) } as never
  );
  return {
    body: (await response.json()) as ApiResponse<Data>["body"],
    requestId: response.headers.get("x-request-id"),
    status: response.status,
  };
};

export const newKey = (): string => `mobile-${randomUUID()}`;

export const isoDay = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

interface TaskSeed {
  readonly archived?: boolean;
  readonly assignees?: readonly string[];
  readonly createdById?: string;
  readonly dueDate?: string | null;
  readonly priority?: string;
  readonly status?: string;
  readonly title?: string;
  readonly type?: "task" | "bug";
}

let numberCounter = 1000;

// Inserts a task straight into the database, in the shared harness project.
export const seedTask = async (seed: TaskSeed = {}): Promise<string> => {
  const taskId = randomUUID();
  numberCounter += 1;
  await authPool.query(
    `INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById", "dueDate", priority, status, type, "archivedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      taskId,
      ids.projectId,
      numberCounter,
      seed.title ?? `Mobile task ${numberCounter}`,
      seed.createdById ?? personaId("owner"),
      seed.dueDate ?? null,
      seed.priority ?? "medium",
      seed.status ?? "todo",
      seed.type ?? "task",
      seed.archived ? new Date() : null,
    ]
  );
  for (const userId of seed.assignees ?? []) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $3)',
      [taskId, userId, personaId("admin")]
    );
  }
  return taskId;
};

// Everything a refused write must leave alone.
export const taskState = async (taskId: string): Promise<unknown> => {
  const [task, assignees, subtasks, comments, activity] = await Promise.all([
    authPool.query("SELECT * FROM task WHERE id = $1", [taskId]),
    authPool.query(
      'SELECT "userId" FROM task_assignee WHERE "taskId" = $1 ORDER BY "userId"',
      [taskId]
    ),
    authPool.query(
      'SELECT * FROM task_subtask WHERE "taskId" = $1 ORDER BY id',
      [taskId]
    ),
    authPool.query('SELECT id FROM comment WHERE "taskId" = $1 ORDER BY id', [
      taskId,
    ]),
    authPool.query('SELECT id FROM activity WHERE "taskId" = $1 ORDER BY id', [
      taskId,
    ]),
  ]);
  return {
    activity: activity.rows,
    assignees: assignees.rows,
    comments: comments.rows,
    subtasks: subtasks.rows,
    task: task.rows,
  };
};

interface SubtaskSeed {
  readonly assigneeId?: string | null;
  readonly completed?: boolean;
  readonly description?: string | null;
  readonly dueDate?: string | null;
}

export const seedSubtask = async (
  taskId: string,
  title: string,
  position = 0,
  seed: SubtaskSeed = {}
): Promise<string> => {
  const subtaskId = randomUUID();
  const completed = seed.completed ?? false;
  await authPool.query(
    `INSERT INTO task_subtask (id, "taskId", title, position, "assigneeId", description, "dueDate", "isCompleted", "completedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      subtaskId,
      taskId,
      title,
      position,
      seed.assigneeId ?? null,
      seed.description ?? null,
      seed.dueDate ?? null,
      completed,
      completed ? new Date() : null,
    ]
  );
  return subtaskId;
};

// A client bug for the shared harness project and company.
export const seedClientBug = async (
  taskId: string,
  companyId: string
): Promise<string> => {
  const bugId = randomUUID();
  await authPool.query(
    `INSERT INTO bug_report (id, "taskId", "projectId", "reporterId", status, severity, "discoverySource", environment, component, route, "reproductionSteps", "expectedBehavior", "actualBehavior", "clientCompanyId", "clientImpact")
     VALUES ($1, $2, $3, $4, 'triaged', 'major', 'customer_report', 'production', 'Portal', '/', ARRAY['Open it'], 'Works', 'Breaks', $5, 'high')`,
    [bugId, taskId, ids.projectId, personaId("client"), companyId]
  );
  return bugId;
};

export const seedComment = async (
  taskId: string,
  authorId: string,
  body: string
): Promise<string> => {
  const commentId = randomUUID();
  await authPool.query(
    `INSERT INTO comment (id, "taskId", "authorId", body, visibility) VALUES ($1, $2, $3, $4, 'internal')`,
    [commentId, taskId, authorId, body]
  );
  return commentId;
};

// The response body must decode with the schema the route advertises, so the
// OpenAPI document and the generated client never drift from the real answer.
export const decodesAs = (route: RouteDefinition, data: unknown): boolean =>
  Schema.is(route.data as Schema.Codec<unknown, unknown, never, never>)(data);
