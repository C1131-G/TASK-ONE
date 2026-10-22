import "server-only";
import { authPool } from "../auth/database";
import { createNotifyPublisher, createRealtimeOutbox } from "./outbox";

const outbox = createRealtimeOutbox(
  createNotifyPublisher((sql, values) => authPool.query(sql, [...values]))
);

// Raises realtime events. Inside a database transaction they are held until
// it commits; outside one they go out immediately.
export const queueRealtimeEvents = outbox.queue;

// Runs a transaction so that the events queued inside it are published once,
// after it commits, and dropped if it rolls back.
export const withRealtimeOutbox = outbox.scope;
