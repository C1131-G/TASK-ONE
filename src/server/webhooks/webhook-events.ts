import { Schema } from "effect";

// The only place that decides what leaves the system. Each event type lists
// the exact fields it may carry: ids and public values, never descriptions,
// comment text, client-hidden records or contact details. Callers pass raw
// records; anything not listed here is dropped.

export const WEBHOOK_EVENT_TYPES = [
  "task.created",
  "task.updated",
  "task.completed",
  "comment.added",
  "bug.status_changed",
  "project.created",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const isWebhookEventType = (value: string): value is WebhookEventType =>
  WEBHOOK_EVENT_TYPES.some((type) => type === value);

export const WEBHOOK_EVENT_LABELS: Readonly<Record<WebhookEventType, string>> =
  {
    "bug.status_changed": "Bug status changed",
    "comment.added": "Comment added",
    "project.created": "Project created",
    "task.completed": "Task completed",
    "task.created": "Task created",
    "task.updated": "Task updated",
  };

export type WebhookValue = string | number | null;
export type WebhookData = Readonly<Record<string, WebhookValue>>;

// A type alias, not an interface, so it is assignable to a JSON column.
export interface WebhookEvent {
  readonly id: string;
  readonly type: WebhookEventType;
  readonly version: 1;
  readonly createdAt: string;
  readonly data: WebhookData;
}

type FieldReader = (value: unknown) => WebhookValue;

const text: FieldReader = (value) => (typeof value === "string" ? value : null);
const count: FieldReader = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const ISO_DATE_LENGTH = 10;
const day: FieldReader = (value) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, ISO_DATE_LENGTH);
  }
  return typeof value === "string" ? value.slice(0, ISO_DATE_LENGTH) : null;
};

const taskFields = {
  dueDate: day,
  id: text,
  priority: text,
  projectId: text,
  projectTaskNumber: count,
  status: text,
  title: text,
} as const;

const fieldsByType = {
  "bug.status_changed": {
    bugId: text,
    from: text,
    projectId: text,
    taskId: text,
    to: text,
  },
  "comment.added": {
    id: text,
    projectId: text,
    taskId: text,
    visibility: text,
  },
  "project.created": { id: text, name: text },
  "task.completed": taskFields,
  "task.created": taskFields,
  "task.updated": taskFields,
} as const satisfies Record<
  WebhookEventType,
  Readonly<Record<string, FieldReader>>
>;

export const WebhookEventSchema = Schema.Struct({
  createdAt: Schema.String,
  data: Schema.Record(
    Schema.String,
    Schema.NullOr(Schema.Union([Schema.String, Schema.Number]))
  ),
  id: Schema.String,
  type: Schema.Literals(WEBHOOK_EVENT_TYPES),
  version: Schema.Literal(1),
});

export interface EventSource {
  readonly id: string;
  readonly createdAt: Date;
  readonly data: Readonly<Record<string, unknown>>;
}

export const buildWebhookEvent = (
  type: WebhookEventType,
  source: EventSource
): WebhookEvent => ({
  createdAt: source.createdAt.toISOString(),
  data: Object.fromEntries(
    Object.entries(fieldsByType[type]).map(([field, read]) => [
      field,
      read(source.data[field]),
    ])
  ),
  id: source.id,
  type,
  version: 1,
});

// Slack renders &, < and > as markup (<!channel>, <@user>, links), so a title
// is escaped to plain text before it joins a message.
const escapeSlack = (value: WebhookValue | undefined): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const subjectOf = (event: WebhookEvent): string => {
  const { data } = event;
  switch (event.type) {
    case "bug.status_changed": {
      return `${escapeSlack(data["from"])} to ${escapeSlack(data["to"])}`;
    }
    case "comment.added": {
      return `on task ${escapeSlack(data["taskId"])}`;
    }
    case "project.created": {
      return escapeSlack(data["name"]);
    }
    case "task.completed":
    case "task.created":
    case "task.updated": {
      return escapeSlack(data["title"]);
    }
    default: {
      const unhandled: never = event.type;
      return unhandled;
    }
  }
};

export const formatSlackMessage = (
  event: WebhookEvent
): { readonly text: string } => ({
  text: `${WEBHOOK_EVENT_LABELS[event.type]}: ${subjectOf(event)}`.trim(),
});
