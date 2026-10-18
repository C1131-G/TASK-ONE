import { formatBugDate } from "../bug-workflow-ui-shared";
import type { BugHistory } from "../bug-workflow-ui-shared";

export const CLOSED_STATUSES = new Set(["closed", "duplicate", "withdrawn"]);

export const IMPACT_LABELS = {
  high: "High impact",
  low: "Low impact",
  medium: "Medium impact",
  urgent: "Urgent impact",
} as const;

export const RESOLUTION_TEXT: Record<string, string> = {
  confirmed: "Client confirmed the fix",
  no_response: "Auto-closed: no response from the client",
  not_a_bug: "Closed as not a bug",
  unconfirmed: "Auto-closed: client did not verify within 7 days",
};

export const DAY_MS = 86_400_000;
export const MAX_CLIENT_REOPENS = 3;

export const addDays = (value: string, days: number): string =>
  formatBugDate(
    new Date(new Date(value).getTime() + days * DAY_MS).toISOString()
  );

export const waitingText = (
  status: string,
  report: NonNullable<BugHistory["clientReport"]>
): string | null => {
  if (status === "needs_info" && report.needsInfoSince) {
    return `Waiting for the client since ${formatBugDate(report.needsInfoSince)} (auto-closes ${addDays(report.needsInfoSince, 14)})`;
  }
  if (status === "awaiting_client" && report.awaitingClientSince) {
    return `Waiting for the client to verify since ${formatBugDate(report.awaitingClientSince)} (auto-closes ${addDays(report.awaitingClientSince, 7)})`;
  }
  return null;
};
