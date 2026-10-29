import "server-only";
import { Effect } from "effect";
import { Client } from "pg";

import { db } from "@/src/prisma/db";

import { AuthSession, AuthSessionLive } from "../auth/session";
import { AppError } from "../core/action-result";
import type { AppErrorCode } from "../core/action-result";
import { parseDatabaseEnv } from "../core/env";
import { canViewerReceive } from "./access";
import type { AccessLookups, RealtimeViewer } from "./access";
import { REALTIME_CHANNEL } from "./events";
import { createRealtimeHub } from "./hub";
import type { Listener, ListenerHandlers } from "./hub";
import { HEARTBEAT_INTERVAL_MS, createRealtimeStream } from "./stream";

const MAX_CONNECTIONS_PER_USER = 5;

const ignoreError = (): undefined => undefined;

const lookups: AccessLookups = {
  clientCanSeeTask: async (companyId, taskId) => {
    const bug = await db.orm.public.BugReport.where({
      clientCompanyId: companyId,
      taskId,
    })
      .select("id")
      .first();
    return bug !== null;
  },
  isActive: async (userId) => {
    const user = await db.orm.public.User.where({ id: userId })
      .select("deactivatedAt", "mustChangePassword")
      .first();
    return user !== null && !user.deactivatedAt && !user.mustChangePassword;
  },
};

// One LISTEN connection per server process, kept apart from the query pool so
// a long-lived session never holds a pooled connection.
const openPgListener = async (
  handlers: ListenerHandlers
): Promise<Listener> => {
  const client = new Client({
    connectionString: parseDatabaseEnv().DATABASE_URL,
    keepAlive: true,
  });
  let finished = false;
  const finish = async (): Promise<void> => {
    finished = true;
    client.removeAllListeners();
    // A late socket error after teardown must not crash the process.
    client.on("error", ignoreError);
    await client.end().catch(ignoreError);
  };
  const lost = (): void => {
    if (!finished) {
      void finish();
      handlers.onLost();
    }
  };
  client.on("notification", (message) => {
    if (message.channel === REALTIME_CHANNEL && message.payload) {
      handlers.onPayload(message.payload);
    }
  });
  client.on("error", lost);
  client.on("end", lost);
  try {
    await client.connect();
    await client.query(`LISTEN ${REALTIME_CHANNEL}`);
  } catch (error) {
    await finish();
    throw error;
  }
  return { close: finish };
};

declare global {
  var realtimeHub: ReturnType<typeof createRealtimeHub> | undefined;
}

const createHub = () =>
  createRealtimeHub({
    authorize: (viewer, event) => canViewerReceive(viewer, event, lookups),
    maxConnectionsPerUser: MAX_CONNECTIONS_PER_USER,
    openListener: openPgListener,
    schedule: (task, delayMs) => {
      const timer = setTimeout(task, delayMs);
      return () => {
        clearTimeout(timer);
      };
    },
  });

// Kept on globalThis so development reloads reuse the one connection.
globalThis.realtimeHub ??= createHub();
const hub = globalThis.realtimeHub;

const STATUS_BY_CODE: Partial<Record<AppErrorCode, number>> = {
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
};
const UNAVAILABLE_STATUS = 503;

const failure = (error: AppError): Response =>
  new Response(null, {
    headers: { "cache-control": "no-store" },
    status: STATUS_BY_CODE[error.code] ?? UNAVAILABLE_STATUS,
  });

const resolveViewer = (
  headers: Headers
): Effect.Effect<RealtimeViewer, AppError> =>
  Effect.gen(function* authenticate() {
    const session = yield* AuthSession;
    const user = yield* session.requireAuthenticated(headers);
    if (user.mustChangePassword) {
      return yield* Effect.fail(
        new AppError({
          code: "FORBIDDEN",
          message: "Change your password before continuing.",
        })
      );
    }
    return {
      clientCompanyId: user.clientCompanyId,
      id: user.id,
      role: user.role,
    };
  }).pipe(Effect.provide(AuthSessionLive));

// The response for GET /api/events: an event stream of what changed, filtered
// to what this viewer may know, or the status that explains why not.
export const openRealtimeResponse = async (
  request: Request
): Promise<Response> => {
  const outcome = await Effect.runPromise(
    resolveViewer(request.headers).pipe(
      Effect.match({
        onFailure: (error) => ({ error, ok: false as const }),
        onSuccess: (viewer) => ({ ok: true as const, viewer }),
      })
    )
  );
  if (!outcome.ok) {
    return failure(outcome.error);
  }
  const stream = createRealtimeStream({
    hub,
    lastEventId: request.headers.get("last-event-id"),
    schedulePing: (onPing) => {
      const timer = setInterval(onPing, HEARTBEAT_INTERVAL_MS);
      return () => {
        clearInterval(timer);
      };
    },
    signal: request.signal,
    viewer: outcome.viewer,
  });
  return new Response(stream, {
    headers: {
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff",
    },
  });
};
