import type { SlaSettings } from "../company/sla-settings";
import { businessElapsedMs } from "../work/business-time";

const MINUTE_MS = 60_000;

const ratio = (part: number, whole: number): number | null =>
  whole > 0 ? part / whole : null;

interface InsightBug {
  readonly clientReopenCount: number;
  readonly resolution: string | null;
  readonly satisfaction: "up" | "down" | null;
  readonly status: string;
}

interface InsightSla {
  readonly breachedResolution: boolean;
  readonly breachedResponse: boolean;
  readonly createdAt: Date;
  readonly firstRespondedAt: Date | null;
}

// How a company's support is going, from its bugs and their SLA clocks.
export const companyInsight = (
  bugs: readonly InsightBug[],
  slas: readonly InsightSla[],
  settings: SlaSettings
) => {
  const responded = slas.flatMap((sla) =>
    sla.firstRespondedAt
      ? [
          businessElapsedMs(
            sla.createdAt,
            sla.firstRespondedAt,
            settings.calendar
          ),
        ]
      : []
  );
  const totalResponseMs = responded.reduce((sum, value) => sum + value, 0);
  // A bug counts as handed over once the client has been asked to verify it
  // at least once.
  const handedOver = bugs.filter(
    (bug) =>
      bug.clientReopenCount > 0 ||
      bug.status === "awaiting_client" ||
      bug.resolution === "confirmed" ||
      bug.resolution === "unconfirmed"
  );
  const reopened = handedOver.filter((bug) => bug.clientReopenCount > 0);
  const up = bugs.filter(({ satisfaction }) => satisfaction === "up").length;
  const rated = bugs.filter(({ satisfaction }) => satisfaction !== null).length;
  return {
    averageFirstResponseMinutes:
      responded.length > 0
        ? Math.round(totalResponseMs / responded.length / MINUTE_MS)
        : null,
    reopenRate: ratio(reopened.length, handedOver.length),
    slaBreachRate: ratio(
      slas.filter(
        ({ breachedResolution, breachedResponse }) =>
          breachedResolution || breachedResponse
      ).length,
      slas.length
    ),
    thumbsUpRate: ratio(up, rated),
  };
};
