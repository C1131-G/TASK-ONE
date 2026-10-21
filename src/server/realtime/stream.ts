import { randomUUID } from "node:crypto";

import type { RealtimeViewer } from "./access";
import { encodeRealtimeEvent } from "./events";
import type { HubMessage, HubSink } from "./hub";

export const RECONNECT_DELAY_MS = 5000;
export const HEARTBEAT_INTERVAL_MS = 25_000;

interface StreamOptions {
  readonly viewer: RealtimeViewer;
  readonly hub: {
    readonly subscribe: (
      viewer: RealtimeViewer,
      sink: HubSink
    ) => Promise<() => void>;
  };
  // The Last-Event-ID header: present only when the browser is reconnecting.
  readonly lastEventId: string | null;
  readonly signal: AbortSignal;
  // Runs the onPing on every heartbeat and returns a function that stops it.
  readonly schedulePing: (onPing: () => void) => () => void;
}

const encoder = new TextEncoder();

// Server-Sent Events carry no history: NOTIFY is fire and forget. A client
// that reconnects is therefore told to refetch rather than replayed events.
const frame = (lines: readonly string[]): Uint8Array =>
  encoder.encode(`${lines.join("\n")}\n\n`);

export const createRealtimeStream = (
  options: StreamOptions
): ReadableStream<Uint8Array> => {
  const epoch = randomUUID();
  let sequence = 0;
  let ended = false;
  let unsubscribe: (() => void) | null = null;
  let stopPing: (() => void) | null = null;
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const teardown = (): void => {
    if (ended) {
      return;
    }
    ended = true;
    stopPing?.();
    stopPing = null;
    unsubscribe?.();
    unsubscribe = null;
    options.signal.removeEventListener("abort", teardown);
    try {
      controller?.close();
    } catch {
      // Already closed by the consumer.
    }
  };

  const write = (chunk: Uint8Array): void => {
    if (ended) {
      return;
    }
    try {
      controller?.enqueue(chunk);
    } catch {
      teardown();
    }
  };

  const sink: HubSink = {
    close: () => {
      write(frame(["event: closed", "data: {}"]));
      teardown();
    },
    send: (message: HubMessage) => {
      if (message.type === "resync") {
        write(frame(["event: resync", "data: {}"]));
        return;
      }
      sequence += 1;
      write(
        frame([
          `id: ${epoch}-${sequence}`,
          "event: change",
          `data: ${encodeRealtimeEvent(message.event)}`,
        ])
      );
    },
  };

  return new ReadableStream<Uint8Array>({
    cancel: () => {
      teardown();
    },
    start: async (streamController) => {
      controller = streamController;
      if (options.signal.aborted) {
        teardown();
        return;
      }
      options.signal.addEventListener("abort", teardown, { once: true });
      write(frame([`retry: ${RECONNECT_DELAY_MS}`, ": connected"]));
      if (options.lastEventId) {
        write(frame(["event: resync", "data: {}"]));
      }
      stopPing = options.schedulePing(() => {
        write(encoder.encode(": ping\n\n"));
      });
      const release = await options.hub.subscribe(options.viewer, sink);
      if (ended) {
        release();
        return;
      }
      unsubscribe = release;
    },
  });
};
