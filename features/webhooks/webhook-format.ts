import {
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENT_TYPES,
  isWebhookEventType,
} from "@/src/server/webhooks/webhook-events";
import type { WebhookEventType } from "@/src/server/webhooks/webhook-events";

type StatusTone = "amber" | "gray" | "green" | "red";

interface StatusBadge {
  readonly label: string;
  readonly tone: StatusTone;
}

const STATUS_BADGES: Readonly<Record<string, StatusBadge>> = {
  dead: { label: "Failed", tone: "red" },
  pending: { label: "Queued", tone: "gray" },
  retrying: { label: "Retrying", tone: "amber" },
  succeeded: { label: "Delivered", tone: "green" },
};

export const deliveryStatusBadge = (status: string): StatusBadge =>
  STATUS_BADGES[status] ?? { label: status, tone: "gray" };

export const endpointKindLabel = (kind: string): string =>
  kind === "slack" ? "Slack incoming webhook" : "Signed webhook";

export const describeEvents = (events: readonly string[]): string => {
  const labels: string[] = [];
  for (const event of events) {
    if (isWebhookEventType(event)) {
      labels.push(WEBHOOK_EVENT_LABELS[event]);
    }
  }
  return labels.length > 0 ? labels.join(", ") : "No events";
};

/** Checked events in the order the form lists them, ignoring anything else. */
export const parseSelectedEvents = (
  formData: FormData
): readonly WebhookEventType[] => {
  const chosen = new Set(formData.getAll("events").map(String));
  return WEBHOOK_EVENT_TYPES.filter((event) => chosen.has(event));
};
