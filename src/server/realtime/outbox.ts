import { AsyncLocalStorage } from "node:async_hooks";

import { logger } from "../core/logger";
import { REALTIME_CHANNEL, encodeRealtimeEvent } from "./events";
import type { RealtimeEvent } from "./events";

export type PublishEvents = (events: readonly RealtimeEvent[]) => Promise<void>;

type Query = (sql: string, values: readonly unknown[]) => Promise<unknown>;

// Sends each event as one NOTIFY payload. A failed publish is logged and
// dropped: the write it describes has already committed, and clients also
// catch up on reconnect and on focus.
export const createNotifyPublisher =
  (query: Query): PublishEvents =>
  async (events) => {
    if (events.length === 0) {
      return;
    }
    try {
      await query(
        "SELECT pg_notify($1, payload) FROM unnest($2::text[]) AS payload",
        [REALTIME_CHANNEL, events.map(encodeRealtimeEvent)]
      );
    } catch (error) {
      logger.warn("A realtime event could not be published.", { error });
    }
  };

const eventKey = (event: RealtimeEvent): string => encodeRealtimeEvent(event);

// Collects the events a unit of work raises and releases them only when that
// work succeeds, so a rolled back transaction never tells anyone about it.
export const createRealtimeOutbox = (publish: PublishEvents) => {
  const scopes = new AsyncLocalStorage<Map<string, RealtimeEvent>>();
  return {
    queue: (events: readonly RealtimeEvent[]): void => {
      const pending = scopes.getStore();
      if (!pending) {
        void publish(events);
        return;
      }
      for (const event of events) {
        pending.set(eventKey(event), event);
      }
    },
    scope: async <Result>(work: () => Promise<Result>): Promise<Result> => {
      if (scopes.getStore()) {
        return work();
      }
      const pending = new Map<string, RealtimeEvent>();
      const result = await scopes.run(pending, work);
      await publish([...pending.values()]);
      return result;
    },
  };
};
