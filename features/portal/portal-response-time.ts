import type { PortalResponseTimes } from "@/src/server/portal/portal-contracts";

const MINUTES_PER_HOUR = 60;

const plural = (count: number, unit: string): string =>
  `${count} ${unit}${count === 1 ? "" : "s"}`;

const trimmed = (value: number): string => String(Math.round(value * 10) / 10);

// A first-response target in business minutes as natural text: business days
// from one full business day up, otherwise business hours or minutes.
export const formatResponseTarget = (
  minutes: number,
  times: Pick<PortalResponseTimes, "businessEndMinute" | "businessStartMinute">
): string => {
  const dayMinutes = times.businessEndMinute - times.businessStartMinute;
  if (dayMinutes > 0 && minutes >= dayMinutes) {
    const days = Math.round((minutes / dayMinutes) * 10) / 10;
    return `${trimmed(days)} business ${days === 1 ? "day" : "days"}`;
  }
  if (minutes < MINUTES_PER_HOUR) {
    return plural(Math.max(1, Math.round(minutes)), "business minute");
  }
  const hours = minutes / MINUTES_PER_HOUR;
  return `${trimmed(hours)} business ${hours === 1 ? "hour" : "hours"}`;
};

export const usuallyRespondText = (
  minutes: number,
  times: Pick<PortalResponseTimes, "businessEndMinute" | "businessStartMinute">
): string =>
  `We usually respond within ${formatResponseTarget(minutes, times)}.`;
