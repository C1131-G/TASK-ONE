import { logger } from "../core/logger";
import type { RealtimeViewer } from "./access";
import { decodeRealtimeEvent } from "./events";
import type { RealtimeEvent } from "./events";

export type HubMessage =
  | { readonly type: "event"; readonly event: RealtimeEvent }
  // Events may have been missed (the listener reconnected): refetch everything.
  | { readonly type: "resync" };

export interface HubSink {
  readonly send: (message: HubMessage) => void;
  readonly close: () => void;
}

export interface ListenerHandlers {
  readonly onPayload: (raw: string) => void;
  // The database connection ended or failed.
  readonly onLost: () => void;
}

export interface Listener {
  readonly close: () => Promise<void>;
}

interface HubOptions {
  readonly openListener: (handlers: ListenerHandlers) => Promise<Listener>;
  readonly authorize: (
    viewer: RealtimeViewer,
    event: RealtimeEvent
  ) => Promise<boolean>;
  readonly maxConnectionsPerUser: number;
  // Runs the task later and returns a function that cancels it.
  readonly schedule: (task: () => void, delayMs: number) => () => void;
  readonly reconnectDelayMs?: number;
}

interface Subscriber {
  readonly viewer: RealtimeViewer;
  readonly sink: HubSink;
}

const DEFAULT_RECONNECT_DELAY_MS = 2000;

// Fans events from one dedicated LISTEN connection out to every connected
// stream. Every delivery passes the access filter first.
export const createRealtimeHub = (options: HubOptions) => {
  const subscribers = new Set<Subscriber>();
  let listener: Promise<Listener> | null = null;
  let cancelReconnect: (() => void) | null = null;

  // The steps refer to one another, so they live on one object.
  const steps = {
    closeListener: async (pending: Promise<Listener>): Promise<void> => {
      try {
        const open = await pending;
        await open.close();
      } catch (error) {
        logger.warn("The realtime listener did not close cleanly.", { error });
      }
    },
    deliver: (subscriber: Subscriber, message: HubMessage): void => {
      try {
        subscriber.sink.send(message);
      } catch {
        subscribers.delete(subscriber);
        steps.stopWhenEmpty();
      }
    },
    ensureListener: (): Promise<Listener> => {
      listener ??= steps.openListener();
      return listener;
    },
    fanOut: async (event: RealtimeEvent): Promise<void> => {
      await Promise.all(
        [...subscribers].map(async (subscriber) => {
          let allowed = false;
          try {
            allowed = await options.authorize(subscriber.viewer, event);
          } catch (error) {
            logger.warn("A realtime access check failed.", { error });
          }
          if (allowed && subscribers.has(subscriber)) {
            steps.deliver(subscriber, { event, type: "event" });
          }
        })
      );
    },
    handlers: {
      onLost: (): void => {
        listener = null;
        if (subscribers.size === 0) {
          return;
        }
        cancelReconnect?.();
        cancelReconnect = options.schedule(() => {
          cancelReconnect = null;
          void steps.reconnect();
        }, options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS);
      },
      onPayload: (raw: string): void => {
        const event = decodeRealtimeEvent(raw);
        if (event) {
          void steps.fanOut(event);
        }
      },
    } satisfies ListenerHandlers,
    openListener: async (): Promise<Listener> => {
      try {
        return await options.openListener(steps.handlers);
      } catch (error) {
        listener = null;
        logger.warn("The realtime listener could not connect.", { error });
        // Schedules the next attempt.
        steps.handlers.onLost();
        throw error;
      }
    },
    reconnect: async (): Promise<void> => {
      if (subscribers.size === 0) {
        return;
      }
      try {
        await steps.ensureListener();
      } catch {
        // The failed attempt already scheduled the next one.
        return;
      }
      for (const subscriber of subscribers) {
        steps.deliver(subscriber, { type: "resync" });
      }
    },
    stopWhenEmpty: (): void => {
      if (subscribers.size > 0) {
        return;
      }
      cancelReconnect?.();
      cancelReconnect = null;
      const current = listener;
      listener = null;
      if (current) {
        void steps.closeListener(current);
      }
    },
  };

  const evictOldest = (userId: string): void => {
    const own = [...subscribers].filter(
      (subscriber) => subscriber.viewer.id === userId
    );
    for (const stale of own.slice(
      0,
      Math.max(0, own.length - options.maxConnectionsPerUser + 1)
    )) {
      subscribers.delete(stale);
      stale.sink.close();
    }
  };

  return {
    subscribe: async (
      viewer: RealtimeViewer,
      sink: HubSink
    ): Promise<() => void> => {
      evictOldest(viewer.id);
      const subscriber: Subscriber = { sink, viewer };
      subscribers.add(subscriber);
      try {
        await steps.ensureListener();
      } catch {
        // The stream stays open; the listener keeps retrying and a resync
        // follows once it connects.
      }
      return () => {
        subscribers.delete(subscriber);
        steps.stopWhenEmpty();
      };
    },
    subscriberCount: (): number => subscribers.size,
  };
};
