// RFC 5545 rendering for the personal calendar feed. Pure: no database access.

const FOLD_LIMIT = 75;
const LINE_BREAKS = /\r\n|\r|\n/gu;
const TEXT_SPECIALS = /[\\;,]/gu;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;
const MILLISECONDS_PER_DAY = 86_400_000;

export const escapeIcalText = (value: string): string =>
  value
    .replaceAll(TEXT_SPECIALS, (match) => `\\${match}`)
    .replaceAll(LINE_BREAKS, "\\n");

// Content lines may not exceed 75 octets. Continuations start with a space
// (which counts toward their own limit) and never split a UTF-8 character.
export const foldIcalLine = (line: string): string => {
  if (Buffer.byteLength(line, "utf-8") <= FOLD_LIMIT) {
    return line;
  }
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const character of line) {
    const bytes = Buffer.byteLength(character, "utf-8");
    const limit = parts.length === 0 ? FOLD_LIMIT : FOLD_LIMIT - 1;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
};

const compactDate = (date: string): string => date.replaceAll("-", "");

const nextDate = (date: string): string => {
  if (!DATE_ONLY.test(date)) {
    throw new Error("Task due dates must be YYYY-MM-DD.");
  }
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + MILLISECONDS_PER_DAY);
  return next.toISOString().slice(0, 10);
};

const utcStamp = (date: Date): string =>
  date
    .toISOString()
    .replaceAll(/[-:]/gu, "")
    .replace(/\.\d{3}/u, "");

export interface FeedTask {
  readonly description: string | null;
  readonly dueDate: string;
  readonly id: string;
  readonly projectName: string;
  readonly title: string;
}

export interface FeedEvent {
  readonly description: string | null;
  readonly endsAt: Date | null;
  readonly id: string;
  readonly location: string | null;
  readonly startsAt: Date;
  readonly title: string;
}

export interface CalendarInput {
  readonly events: readonly FeedEvent[];
  readonly name: string;
  readonly now: Date;
  readonly tasks: readonly FeedTask[];
}

const textLine = (name: string, value: string): string =>
  `${name}:${escapeIcalText(value)}`;

const taskLines = (task: FeedTask, stamp: string): string[] => [
  "BEGIN:VEVENT",
  `UID:task-${task.id}@taskora`,
  `DTSTAMP:${stamp}`,
  `DTSTART;VALUE=DATE:${compactDate(task.dueDate)}`,
  `DTEND;VALUE=DATE:${compactDate(nextDate(task.dueDate))}`,
  textLine("SUMMARY", task.title),
  ...(task.description ? [textLine("DESCRIPTION", task.description)] : []),
  textLine("CATEGORIES", task.projectName),
  "TRANSP:TRANSPARENT",
  "END:VEVENT",
];

const eventLines = (event: FeedEvent, stamp: string): string[] => [
  "BEGIN:VEVENT",
  `UID:event-${event.id}@taskora`,
  `DTSTAMP:${stamp}`,
  `DTSTART:${utcStamp(event.startsAt)}`,
  ...(event.endsAt ? [`DTEND:${utcStamp(event.endsAt)}`] : []),
  textLine("SUMMARY", event.title),
  ...(event.description ? [textLine("DESCRIPTION", event.description)] : []),
  ...(event.location ? [textLine("LOCATION", event.location)] : []),
  "END:VEVENT",
];

export const buildCalendar = (input: CalendarInput): string => {
  const stamp = utcStamp(input.now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Taskora//Calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    textLine("X-WR-CALNAME", input.name),
    ...input.tasks.flatMap((task) => taskLines(task, stamp)),
    ...input.events.flatMap((event) => eventLines(event, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map((line) => `${foldIcalLine(line)}\r\n`).join("");
};
