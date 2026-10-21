import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type {
  WebhookDeliverySummary,
  WebhookEndpointSummary,
  WebhookKind,
  WebhookStatus,
} from "./webhook-contracts";
import { WEBHOOK_KINDS, WEBHOOK_STATUSES } from "./webhook-contracts";
import { parseWebhookUrl } from "./webhook-url-guard";

export const isProduction = (): boolean =>
  process.env["NODE_ENV"] === "production";

export const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "Webhooks could not be loaded or saved.",
      });

export const requireAdmin = async (actorId: string): Promise<void> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("role", "deactivatedAt", "mustChangePassword")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword || actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
};

const SLACK_HOST = "hooks.slack.com";
const SLACK_PATH_PREFIX = "/services/";

/** Validates the destination for the endpoint kind and returns the stored URL. */
export const validateDestination = (
  kind: WebhookKind,
  raw: string,
  production: boolean = isProduction()
): string => {
  // Slack always requires HTTPS; other endpoints follow the deployment mode.
  const url = parseWebhookUrl(raw, {
    production: kind === "slack" || production,
  });
  if (
    kind === "slack" &&
    (url.hostname !== SLACK_HOST || !url.pathname.startsWith(SLACK_PATH_PREFIX))
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      field: "url",
      message:
        "Enter a Slack incoming webhook URL (hooks.slack.com/services/…).",
    });
  }
  return url.toString();
};

// Query strings and Slack paths can carry tokens, so neither is displayed.
const displayUrl = (kind: WebhookKind, stored: string): string => {
  const url = new URL(stored);
  return kind === "slack"
    ? `${url.origin}${SLACK_PATH_PREFIX}…`
    : `${url.origin}${url.pathname}`;
};

const kindOf = (value: string): WebhookKind =>
  WEBHOOK_KINDS.find((kind) => kind === value) ?? "generic";

const statusOf = (value: string): WebhookStatus =>
  WEBHOOK_STATUSES.find((status) => status === value) ?? "pending";

interface EndpointRow {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly url: string;
  readonly events: readonly string[];
  readonly enabled: boolean;
  readonly secretHint: string | null;
  readonly createdAt: Date;
}

export const toEndpointSummary = (row: EndpointRow): WebhookEndpointSummary => {
  const kind = kindOf(row.kind);
  return {
    createdAt: row.createdAt.toISOString(),
    displayUrl: displayUrl(kind, row.url),
    enabled: row.enabled,
    events: [...row.events],
    id: row.id,
    kind,
    name: row.name.trim(),
    secretHint: row.secretHint,
  };
};

interface DeliveryRow {
  readonly id: string;
  readonly endpointId: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly status: string;
  readonly attempts: number;
  readonly responseCode: number | null;
  readonly responseBody: string | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly deliveredAt: Date | null;
}

export const toDeliverySummary = (
  row: DeliveryRow
): WebhookDeliverySummary => ({
  attempts: row.attempts,
  createdAt: row.createdAt.toISOString(),
  deliveredAt: row.deliveredAt?.toISOString() ?? null,
  endpointId: row.endpointId,
  eventId: row.eventId,
  eventType: row.eventType,
  id: row.id,
  lastError: row.lastError,
  responseBody: row.responseBody,
  responseCode: row.responseCode,
  status: statusOf(row.status),
});

export const notFound = (): AppError =>
  new AppError({ code: "NOT_FOUND", message: "That webhook was not found." });
