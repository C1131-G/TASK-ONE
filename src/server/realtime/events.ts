import { Schema } from "effect";

// The Postgres NOTIFY channel every process listens on.
export const REALTIME_CHANNEL = "metsys_realtime";

const uuid = Schema.String.check(Schema.isUUID());

// A realtime event names what changed, never what it changed to: the entity
// kind and ids only. Clients react by refetching through the normal,
// permission-checked reads.
const RealtimeEventSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("task"),
    projectId: Schema.NullOr(uuid),
    taskId: uuid,
  }),
  Schema.Struct({ kind: Schema.Literal("project"), projectId: uuid }),
  Schema.Struct({
    kind: Schema.Literal("comment"),
    taskId: uuid,
    // Lets the access check withhold internal comments from clients without
    // a lookup per viewer.
    visibility: Schema.Literals(["internal", "public"]),
  }),
  Schema.Struct({ kind: Schema.Literal("inbox"), userId: uuid }),
]);

export type RealtimeEvent = typeof RealtimeEventSchema.Type;

const isRealtimeEvent = Schema.is(RealtimeEventSchema);
const isUuid = Schema.is(uuid);

export const encodeRealtimeEvent = (event: RealtimeEvent): string =>
  JSON.stringify(event);

// NOTIFY payloads are untrusted input to this process: anything that is not
// exactly a known event is dropped.
export const decodeRealtimeEvent = (raw: string): RealtimeEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isRealtimeEvent(parsed) ? parsed : null;
};

interface ActivityShape {
  readonly action: string;
  readonly taskId?: string | null | undefined;
  readonly projectId?: string | null | undefined;
  readonly details?: unknown;
}

const COMMENT_ACTION_PREFIX = "comment.";

const commentVisibility = (details: unknown): "internal" | "public" =>
  typeof details === "object" &&
  details !== null &&
  "visibility" in details &&
  details.visibility === "public"
    ? "public"
    : "internal";

// Every task-affecting write records an activity row, so the activity is the
// one signal that cannot be forgotten by an individual write path.
export const eventsFromActivity = (
  activity: ActivityShape
): readonly RealtimeEvent[] => {
  const { projectId, taskId } = activity;
  const task = isUuid(taskId) ? taskId : null;
  const project = isUuid(projectId) ? projectId : null;
  if (task && activity.action.startsWith(COMMENT_ACTION_PREFIX)) {
    return [
      {
        kind: "comment",
        taskId: task,
        visibility: commentVisibility(activity.details),
      },
    ];
  }
  if (task) {
    return [{ kind: "task", projectId: project, taskId: task }];
  }
  return project ? [{ kind: "project", projectId: project }] : [];
};
