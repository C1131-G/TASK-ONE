import { lookup } from "node:dns/promises";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { logger } from "../core/logger";
import { WEBHOOK_MAX_ATTEMPTS } from "./webhook-contracts";
import { WebhookEventSchema, formatSlackMessage } from "./webhook-events";
import type { WebhookEvent } from "./webhook-events";
import { postToAddress } from "./webhook-http";
import { isProduction, validateDestination } from "./webhook-internal";
import { decryptSecret, webhookKeyMaterial } from "./webhook-secret";
import { signWebhook } from "./webhook-signing";
import { resolvePublicTarget } from "./webhook-url-guard";
import type { HostResolver } from "./webhook-url-guard";

const REQUEST_TIMEOUT_MS = 5000;
const RESPONSE_READ_BYTES = 4096;
const STORED_BODY_CHARS = 1000;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const HTTP_SERVER_ERROR_MIN = 500;
const RETRYABLE_CLIENT_ERRORS = new Set([408, 429]);
const USER_AGENT = "Metsys-Webhooks/1";

export interface DeliveryDeps {
  readonly resolve: HostResolver;
  readonly post: typeof postToAddress;
  readonly now: () => Date;
  readonly keyMaterial: string;
  readonly production: boolean;
}

const dnsResolve: HostResolver = async (hostname) => {
  const found = await lookup(hostname, { all: true, verbatim: true });
  return found.map(({ address, family }) => ({
    address,
    family: family === 6 ? 6 : 4,
  }));
};

export const liveDeliveryDeps = (): DeliveryDeps => ({
  keyMaterial: webhookKeyMaterial(),
  now: () => new Date(),
  post: postToAddress,
  production: isProduction(),
  resolve: dnsResolve,
});

type Outcome =
  | { readonly kind: "done" }
  | { readonly kind: "skipped" }
  | { readonly kind: "retry" | "dead"; readonly message: string };

// Network failures keep only their error code: the full message can name
// internal hosts that the delivery log should not repeat.
const networkErrorLabel = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }
  const code =
    error instanceof Error && "code" in error ? String(error.code) : "";
  return code ? `Network error (${code}).` : "The request failed.";
};

const printableSnippet = (body: string): string =>
  body.replaceAll("\u0000", "").slice(0, STORED_BODY_CHARS);

const isRetryableStatus = (status: number): boolean =>
  status >= HTTP_SERVER_ERROR_MIN || RETRYABLE_CLIENT_ERRORS.has(status);

const failureMessage = (status: number): string =>
  status >= 300 && status < 400
    ? `The endpoint answered with a redirect (${status}); redirects are not followed.`
    : `The endpoint answered with status ${status}.`;

interface Prepared {
  readonly url: URL;
  readonly headers: Record<string, string>;
  readonly body: string;
}

const prepare = (
  event: WebhookEvent,
  endpoint: {
    readonly kind: string;
    readonly url: string;
    readonly secretCiphertext: string | null;
  },
  deps: DeliveryDeps
): Prepared => {
  const slack = endpoint.kind === "slack";
  const body = JSON.stringify(slack ? formatSlackMessage(event) : event);
  const headers: Record<string, string> = {
    accept: "*/*",
    "content-type": "application/json",
    "user-agent": USER_AGENT,
  };
  if (!slack) {
    if (!endpoint.secretCiphertext) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "The endpoint has no signing secret.",
      });
    }
    const timestamp = Math.floor(deps.now().getTime() / 1000);
    const secret = decryptSecret(endpoint.secretCiphertext, deps.keyMaterial);
    headers["x-metsys-delivery"] = event.id;
    headers["x-metsys-event"] = event.type;
    headers["x-metsys-signature"] = signWebhook(secret, timestamp, body);
    headers["x-metsys-timestamp"] = String(timestamp);
  }
  // Same rules as when the admin saved it, applied again because the stored
  // row or the deployment mode may have changed since.
  const url = new URL(
    validateDestination(
      slack ? "slack" : "generic",
      endpoint.url,
      deps.production
    )
  );
  return { body, headers, url };
};

const record = (
  deliveryId: string,
  fields: {
    readonly attempts: number;
    readonly status: string;
    readonly responseCode?: number | null;
    readonly responseBody?: string | null;
    readonly lastError?: string | null;
    readonly deliveredAt?: Date | null;
  },
  now: Date
) =>
  db.orm.public.WebhookDelivery.where({ id: deliveryId }).update({
    ...fields,
    updatedAt: now,
  });

const attemptDelivery = async (
  deliveryId: string,
  deps: DeliveryDeps
): Promise<Outcome> => {
  const delivery = await db.orm.public.WebhookDelivery.where({
    id: deliveryId,
  }).first();
  if (!delivery) {
    throw new AppError({ code: "NOT_FOUND", message: "Delivery not found." });
  }
  if (delivery.status === "succeeded" || delivery.status === "dead") {
    return { kind: "skipped" };
  }
  const endpoint = await db.orm.public.WebhookEndpoint.where({
    id: delivery.endpointId,
  }).first();
  const now = deps.now();
  const attempts = delivery.attempts + 1;
  if (!endpoint?.enabled) {
    await record(
      deliveryId,
      {
        attempts: delivery.attempts,
        lastError: "The endpoint is disabled.",
        status: "dead",
      },
      now
    );
    return { kind: "skipped" };
  }
  const exhausted = attempts >= WEBHOOK_MAX_ATTEMPTS;
  const failed = async (
    kind: "retry" | "dead",
    message: string,
    response?: { readonly status: number; readonly bodySnippet: string }
  ): Promise<Outcome> => {
    await record(
      deliveryId,
      {
        attempts,
        lastError: message,
        responseBody: response ? printableSnippet(response.bodySnippet) : null,
        responseCode: response?.status ?? null,
        status: kind === "dead" || exhausted ? "dead" : "retrying",
      },
      now
    );
    return { kind: kind === "dead" || exhausted ? "dead" : "retry", message };
  };

  let prepared: Prepared;
  let target: Awaited<ReturnType<typeof resolvePublicTarget>>;
  try {
    const event = Schema.decodeUnknownSync(WebhookEventSchema)(
      delivery.payload
    );
    prepared = prepare(event, endpoint, deps);
    target = await resolvePublicTarget(prepared.url, deps.resolve);
  } catch (error) {
    const permanent =
      !(error instanceof AppError) || error.code !== "UNAVAILABLE";
    return failed(permanent ? "dead" : "retry", networkErrorLabel(error));
  }
  try {
    const response = await deps.post({
      ...target,
      body: prepared.body,
      headers: prepared.headers,
      maxResponseBytes: RESPONSE_READ_BYTES,
      timeoutMs: REQUEST_TIMEOUT_MS,
      url: prepared.url,
    });
    if (response.status >= HTTP_OK_MIN && response.status <= HTTP_OK_MAX) {
      await record(
        deliveryId,
        {
          attempts,
          deliveredAt: now,
          lastError: null,
          responseBody: printableSnippet(response.bodySnippet),
          responseCode: response.status,
          status: "succeeded",
        },
        now
      );
      return { kind: "done" };
    }
    return failed(
      isRetryableStatus(response.status) ? "retry" : "dead",
      failureMessage(response.status),
      response
    );
  } catch (error) {
    return failed("retry", networkErrorLabel(error));
  }
};

/**
 * One delivery attempt, run by the job queue. A transient failure fails the
 * job so the queue retries it with backoff; a permanent one fails it with a
 * code the queue dead-letters at once. The delivery log row mirrors both.
 */
export const deliverWebhook = (
  deliveryId: string,
  deps: DeliveryDeps
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: (error) =>
      error instanceof AppError
        ? error
        : new AppError({
            code: "UNAVAILABLE",
            message: "The webhook delivery could not be recorded.",
          }),
    try: () => attemptDelivery(deliveryId, deps),
  }).pipe(
    Effect.flatMap((outcome) => {
      if (outcome.kind === "done" || outcome.kind === "skipped") {
        return Effect.void;
      }
      logger.warn("A webhook delivery attempt failed.", {
        deliveryId,
        outcome: outcome.kind,
      });
      return Effect.fail(
        new AppError({
          code: outcome.kind === "dead" ? "VALIDATION_FAILED" : "UNAVAILABLE",
          message: outcome.message,
        })
      );
    })
  );
