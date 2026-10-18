import { isAuditEventType } from "@/features/clients/audit-event-types";

export type SearchParams = Record<string, string | string[] | undefined>;

export interface AuditEntry {
  readonly actorName: string | null;
  readonly createdAt: string;
  readonly details: unknown;
  readonly id: string;
  readonly ip: string | null;
  readonly subjectEmail: string | null;
  readonly subjectName: string | null;
  readonly type: string;
  readonly userAgent: string | null;
}

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SECRET_KEY = /pass|secret|token|hash|key|cookie|authorization|session/iu;
const MAX_VALUE_LENGTH = 80;

export const single = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export const validDate = (value: string): string | undefined =>
  DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    ? value
    : undefined;

export const parseFilters = (params: SearchParams) => {
  const type = single(params.type);
  const person = single(params.q).slice(0, 120);
  const from = validDate(single(params.from));
  const to = validDate(single(params.to));
  const limitNumber = Number(single(params.limit));
  const limit =
    Number.isInteger(limitNumber) &&
    limitNumber >= 1 &&
    limitNumber <= MAX_LIMIT
      ? limitNumber
      : undefined;
  return {
    from,
    limit,
    person: person || undefined,
    to,
    type: isAuditEventType(type) ? type : undefined,
  };
};

export type ParsedAuditFilters = ReturnType<typeof parseFilters>;

export const timeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

export const shortenUserAgent = (userAgent: string | null): string => {
  if (!userAgent) {
    return "—";
  }
  const browser = /(?:Edg|OPR|Firefox|Chrome|CriOS|FxiOS|Safari)\/[\d.]+/u.exec(
    userAgent
  )?.[0];
  const system = /\([^;)]+/u.exec(userAgent)?.[0].slice(1);
  const parts = [browser?.replace(/^Edg\//u, "Edge/"), system].filter(Boolean);
  return parts.length ? parts.join(" · ") : userAgent.slice(0, 40);
};

export const isPlainObject = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const detailPairs = (
  details: unknown
): readonly (readonly [string, string])[] => {
  if (!isPlainObject(details)) {
    return [];
  }
  const pairs: (readonly [string, string])[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (SECRET_KEY.test(key) || key === "email") {
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const text = String(value);
      pairs.push([
        key.replaceAll("_", " "),
        text.length > MAX_VALUE_LENGTH
          ? `${text.slice(0, MAX_VALUE_LENGTH)}…`
          : text,
      ]);
    }
  }
  return pairs;
};

export const attemptedEmail = (details: unknown): string | null =>
  isPlainObject(details) && typeof details.email === "string"
    ? details.email.slice(0, 254)
    : null;

// A "to" date covers the whole day, so it filters up to the next midnight.
export const endOfDay = (date: string): string =>
  new Date(
    Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000 - 1
  ).toISOString();
