import type { SlaSettingsValues } from "@/src/server/company/sla-settings";

export type Unit = "minutes" | "hours" | "days";
export type ImpactKey = "low" | "medium" | "high" | "urgent";
export type TargetField = "firstResponseMinutes" | "resolutionMinutes";

export interface TargetDraft {
  readonly unit: Unit;
  readonly value: string;
}

export type Drafts = Record<ImpactKey, Record<TargetField, TargetDraft>>;

// Monday-first display order; values follow 0=Sunday..6=Saturday.
export const WEEKDAYS = [
  { label: "Mon", name: "Monday", value: 1 },
  { label: "Tue", name: "Tuesday", value: 2 },
  { label: "Wed", name: "Wednesday", value: 3 },
  { label: "Thu", name: "Thursday", value: 4 },
  { label: "Fri", name: "Friday", value: 5 },
  { label: "Sat", name: "Saturday", value: 6 },
  { label: "Sun", name: "Sunday", value: 0 },
] as const;

export const IMPACTS: readonly {
  readonly key: ImpactKey;
  readonly label: string;
}[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
];

export const FIELDS: readonly {
  readonly key: TargetField;
  readonly label: string;
}[] = [
  { key: "firstResponseMinutes", label: "First response" },
  { key: "resolutionMinutes", label: "Resolution" },
];

export const SAME_ZONE = "__company__";
export const MAX_MINUTES = 525_600;
export const END_OF_DAY = 1440;

export const minutesToTime = (minutes: number) => {
  const wrapped = minutes >= END_OF_DAY ? 0 : minutes;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  return `${hours}:${String(wrapped % 60).padStart(2, "0")}`;
};

// Closing 00:00 means midnight at the end of the day (1440).
export const timeToMinutes = (time: string, isEnd: boolean) => {
  const [hours, minutes] = time.split(":").map(Number);
  const total = (hours ?? 0) * 60 + (minutes ?? 0);
  return isEnd && total === 0 ? END_OF_DAY : total;
};

export const toDraft = (minutes: number, dayMinutes: number): TargetDraft => {
  if (dayMinutes > 0 && minutes >= dayMinutes && minutes % dayMinutes === 0) {
    return { unit: "days", value: String(minutes / dayMinutes) };
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return { unit: "hours", value: String(minutes / 60) };
  }
  return { unit: "minutes", value: String(minutes) };
};

export const unitMinutes = (unit: Unit, dayMinutes: number) => {
  if (unit === "days") {
    return dayMinutes;
  }
  return unit === "hours" ? 60 : 1;
};

export const buildDrafts = (values: SlaSettingsValues): Drafts => {
  const dayMinutes = values.businessEndMinute - values.businessStartMinute;
  const build = (key: ImpactKey) => ({
    firstResponseMinutes: toDraft(
      values.slaTargets[key].firstResponseMinutes,
      dayMinutes
    ),
    resolutionMinutes: toDraft(
      values.slaTargets[key].resolutionMinutes,
      dayMinutes
    ),
  });
  return {
    high: build("high"),
    low: build("low"),
    medium: build("medium"),
    urgent: build("urgent"),
  };
};

export const readSlaTargets = (drafts: Drafts, dayMinutes: number) => {
  const minutesFor = (impact: ImpactKey, field: TargetField) => {
    const draft = drafts[impact][field];
    const amount = Number(draft.value);
    if (!(draft.value.trim() && Number.isFinite(amount) && amount > 0)) {
      return null;
    }
    return Math.round(amount * unitMinutes(draft.unit, dayMinutes));
  };
  const targets = {} as Record<
    ImpactKey,
    { firstResponseMinutes: number; resolutionMinutes: number }
  >;
  for (const { key, label } of IMPACTS) {
    const first = minutesFor(key, "firstResponseMinutes");
    const resolution = minutesFor(key, "resolutionMinutes");
    if (first === null || resolution === null) {
      return {
        message: `Enter a first response and resolution target for ${label}.`,
      };
    }
    if (
      first < 1 ||
      resolution < 1 ||
      first > MAX_MINUTES ||
      resolution > MAX_MINUTES
    ) {
      return {
        message: `${label} targets must be between 1 minute and ${MAX_MINUTES.toLocaleString("en-US")} minutes of business time.`,
      };
    }
    targets[key] = {
      firstResponseMinutes: first,
      resolutionMinutes: resolution,
    };
  }
  return { targets };
};
