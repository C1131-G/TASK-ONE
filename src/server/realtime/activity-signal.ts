import { eventsFromActivity } from "./events";
import type { RealtimeEvent } from "./events";

type QueueEvents = (events: readonly RealtimeEvent[]) => void;

const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

// Reads through the original object (not the proxy) so classes with private
// fields keep working, and binds methods to their owner for the same reason.
const readMember = (target: object, property: string | symbol): unknown => {
  const value: unknown = Reflect.get(target, property, target);
  return typeof value === "function" ? value.bind(target) : value;
};

const descend = <Target extends object>(
  target: Target,
  child: (property: string | symbol, value: unknown) => unknown
): Target =>
  new Proxy(target, {
    get: (owner, property) => {
      const value = readMember(owner, property);
      return child(property, value);
    },
  });

const signalCreate = (
  model: object,
  create: unknown,
  queue: QueueEvents
): unknown => {
  if (typeof create !== "function") {
    return create;
  }
  return async (row: unknown, ...rest: unknown[]): Promise<unknown> => {
    const created: unknown = await Reflect.apply(create, model, [row, ...rest]);
    if (isObject(row) && "action" in row && typeof row.action === "string") {
      queue(
        eventsFromActivity({
          action: row.action,
          details: "details" in row ? row.details : undefined,
          projectId:
            "projectId" in row && typeof row.projectId === "string"
              ? row.projectId
              : null,
          taskId:
            "taskId" in row && typeof row.taskId === "string"
              ? row.taskId
              : null,
        })
      );
    }
    return created;
  };
};

// Every task-affecting write records an activity row, so watching those
// inserts raises a realtime event from each write path without touching them.
// The event is queued only after the row was written; the outbox releases it
// when the surrounding transaction commits.
export const signalActivityWrites = <Transaction extends object>(
  transaction: Transaction,
  queue: QueueEvents
): Transaction =>
  descend(transaction, (property, orm) => {
    if (property !== "orm" || !isObject(orm)) {
      return orm;
    }
    return descend(orm, (schema, models) => {
      if (schema !== "public" || !isObject(models)) {
        return models;
      }
      return descend(models, (name, model) => {
        if (name !== "Activity" || !isObject(model)) {
          return model;
        }
        return descend(model, (method, member) =>
          method === "create" ? signalCreate(model, member, queue) : member
        );
      });
    });
  });
