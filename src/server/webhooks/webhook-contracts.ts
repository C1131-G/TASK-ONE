import { Schema } from "effect";

import { WEBHOOK_EVENT_TYPES } from "./webhook-events";

export const WEBHOOK_KINDS = ["generic", "slack"] as const;
export type WebhookKind = (typeof WEBHOOK_KINDS)[number];

export const WEBHOOK_STATUSES = [
  "pending",
  "retrying",
  "succeeded",
  "dead",
] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

const MAX_NAME_LENGTH = 80;
const MAX_URL_LENGTH = 2000;

const NameSchema = Schema.String.check(
  Schema.makeFilter((name) =>
    name.trim().length >= 1 && name.length <= MAX_NAME_LENGTH
      ? undefined
      : `Enter a name of up to ${MAX_NAME_LENGTH} characters.`
  )
);
const UrlSchema = Schema.String.check(Schema.isMaxLength(MAX_URL_LENGTH));
const EventsSchema = Schema.Array(Schema.Literals(WEBHOOK_EVENT_TYPES)).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(WEBHOOK_EVENT_TYPES.length)
);

export const WebhookEndpointInputSchema = Schema.Struct({
  events: EventsSchema,
  kind: Schema.Literals(WEBHOOK_KINDS),
  name: NameSchema,
  url: UrlSchema,
});
export type WebhookEndpointInput = typeof WebhookEndpointInputSchema.Type;

export const WebhookEndpointChangesSchema = Schema.Struct({
  enabled: Schema.Boolean,
  events: EventsSchema,
  name: NameSchema,
  // Omitted keeps the stored URL, which the list never shows in full.
  url: Schema.optional(UrlSchema),
});
export type WebhookEndpointChanges = typeof WebhookEndpointChangesSchema.Type;

export const WebhookEndpointSummarySchema = Schema.Struct({
  createdAt: Schema.String,
  displayUrl: Schema.String,
  enabled: Schema.Boolean,
  events: Schema.Array(Schema.String),
  id: Schema.String,
  kind: Schema.Literals(WEBHOOK_KINDS),
  name: Schema.String,
  secretHint: Schema.NullOr(Schema.String),
});
export type WebhookEndpointSummary = typeof WebhookEndpointSummarySchema.Type;

export const WebhookEndpointListSchema = Schema.Array(
  WebhookEndpointSummarySchema
);

export const WebhookEndpointCreatedSchema = Schema.Struct({
  endpoint: WebhookEndpointSummarySchema,
  // Shown once. Slack endpoints are not signed and have none.
  secret: Schema.NullOr(Schema.String),
});
export type WebhookEndpointCreated = typeof WebhookEndpointCreatedSchema.Type;

export const WebhookSecretSchema = Schema.Struct({ secret: Schema.String });

export const WebhookDeliverySummarySchema = Schema.Struct({
  attempts: Schema.Number,
  createdAt: Schema.String,
  deliveredAt: Schema.NullOr(Schema.String),
  endpointId: Schema.String,
  eventId: Schema.String,
  eventType: Schema.String,
  id: Schema.String,
  lastError: Schema.NullOr(Schema.String),
  responseBody: Schema.NullOr(Schema.String),
  responseCode: Schema.NullOr(Schema.Number),
  status: Schema.Literals(WEBHOOK_STATUSES),
});
export type WebhookDeliverySummary = typeof WebhookDeliverySummarySchema.Type;

export const WebhookDeliveryListSchema = Schema.Array(
  WebhookDeliverySummarySchema
);

export const WEBHOOK_DELIVERY_JOB = "webhooks.deliver";
export const WEBHOOK_MAX_ATTEMPTS = 6;
