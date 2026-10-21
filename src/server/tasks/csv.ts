import { Schema } from "effect";

import { CalendarDateSchema } from "../core/input-schemas";

// Pure CSV helpers for task export and import. Nothing here touches the
// database, so every rule can be tested without a fixture.

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 1_000_000;
const MAX_TITLE_LENGTH = 240;
const MAX_DESCRIPTION_LENGTH = 20_000;
const MAX_ASSIGNEES = 100;

export type CsvCell = string | number | null | undefined;

// Spreadsheets run a cell as a formula when it starts with one of these.
const FORMULA_PREFIX = /^[=+\-@\t\r]/u;
const NEEDS_QUOTES = /[",\r\n]/u;
const ESCAPED_FORMULA = /^'[=+\-@\t\r]/u;
const BYTE_ORDER_MARK = "﻿";

export const escapeCsvCell = (value: CsvCell): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return String(value);
  }
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const formatCsv = (rows: readonly (readonly CsvCell[])[]): string =>
  rows.map((row) => `${row.map(escapeCsvCell).join(",")}\r\n`).join("");

export type CsvParseResult =
  | { readonly ok: true; readonly rows: readonly (readonly string[])[] }
  | { readonly ok: false; readonly message: string };

export const parseCsv = (input: string): CsvParseResult => {
  const text = input.startsWith(BYTE_ORDER_MARK) ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let touched = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
    touched = false;
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (inQuotes) {
      if (character !== '"') {
        cell += character;
      } else if (text.charAt(index + 1) === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = false;
      }
    } else if (character === '"') {
      inQuotes = true;
      touched = true;
    } else if (character === ",") {
      endCell();
      touched = true;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text.charAt(index + 1) === "\n") {
        index += 1;
      }
      endRow();
    } else {
      cell += character;
      touched = true;
    }
  }
  if (inQuotes) {
    return { message: "A quoted value is never closed.", ok: false };
  }
  if (touched || cell !== "") {
    endRow();
  }
  return { ok: true, rows };
};

export interface ImportedTaskRow {
  readonly assigneeEmails: readonly string[];
  readonly description: string | null;
  readonly dueDate: string | null;
  // Row number in the file, counting the header as row 1.
  readonly line: number;
  readonly priority: "urgent" | "high" | "medium" | "low" | "none";
  readonly startDate: string | null;
  readonly status: "backlog" | "todo" | "progress" | "review" | "done";
  readonly title: string;
}

export interface ImportRowError {
  readonly column: string | null;
  readonly line: number;
  readonly message: string;
}

export interface TaskImportParse {
  readonly errors: readonly ImportRowError[];
  readonly rows: readonly ImportedTaskRow[];
}

const STATUS_ALIASES: Readonly<Record<string, ImportedTaskRow["status"]>> = {
  backlog: "backlog",
  done: "done",
  "in progress": "progress",
  progress: "progress",
  review: "review",
  "to do": "todo",
  todo: "todo",
};
const PRIORITIES: readonly ImportedTaskRow["priority"][] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];
const COLUMN_ALIASES: Readonly<Record<string, string>> = {
  assignee: "assignees",
  assignee_emails: "assignees",
  due: "due_date",
  due_date: "due_date",
  start: "start_date",
  start_date: "start_date",
};
const HEADER_SEPARATORS = /[\s-]+/gu;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const isCalendarDate = Schema.is(CalendarDateSchema);

const canonicalColumn = (header: string): string => {
  const key = header.trim().toLowerCase().replaceAll(HEADER_SEPARATORS, "_");
  return COLUMN_ALIASES[key] ?? key;
};

// Undo the apostrophe the exporter adds in front of formula-like text.
const readCell = (value: string | undefined): string => {
  const text = (value ?? "").trim();
  return ESCAPED_FORMULA.test(text) ? text.slice(1) : text;
};

const fileError = (message: string): TaskImportParse => ({
  errors: [{ column: null, line: 1, message }],
  rows: [],
});

interface RowReader {
  readonly errors: ImportRowError[];
  readonly line: number;
  readonly read: (column: string) => string;
}

const parseChoice = <Value extends string>(
  reader: RowReader,
  column: string,
  fallback: Value,
  lookup: (text: string) => Value | undefined,
  allowed: string
): Value => {
  const text = reader.read(column).toLowerCase();
  if (!text) {
    return fallback;
  }
  const value = lookup(text);
  if (value === undefined) {
    reader.errors.push({
      column,
      line: reader.line,
      message: `"${text}" is not valid. Use ${allowed}.`,
    });
    return fallback;
  }
  return value;
};

const parseDate = (reader: RowReader, column: string): string | null => {
  const text = reader.read(column);
  if (!text) {
    return null;
  }
  if (!isCalendarDate(text)) {
    reader.errors.push({
      column,
      line: reader.line,
      message: "Use a real date written as YYYY-MM-DD.",
    });
    return null;
  }
  return text;
};

const parseAssignees = (reader: RowReader): readonly string[] => {
  const emails = reader
    .read("assignees")
    .split(/[;,]/u)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(emails)];
  if (
    unique.length > MAX_ASSIGNEES ||
    unique.some((email) => !EMAIL_PATTERN.test(email))
  ) {
    reader.errors.push({
      column: "assignees",
      line: reader.line,
      message: "List up to 100 valid email addresses separated by semicolons.",
    });
    return [];
  }
  return unique;
};

const parseTitle = (reader: RowReader): string => {
  const title = reader.read("title");
  if (!title || title.length > MAX_TITLE_LENGTH) {
    reader.errors.push({
      column: "title",
      line: reader.line,
      message: "Enter a title between 1 and 240 characters.",
    });
  }
  return title;
};

const parseDescription = (reader: RowReader): string | null => {
  const description = reader.read("description");
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    reader.errors.push({
      column: "description",
      line: reader.line,
      message: "Keep the description under 20,000 characters.",
    });
  }
  return description || null;
};

const parseRow = (
  reader: RowReader,
  errors: ImportRowError[]
): ImportedTaskRow | undefined => {
  const before = errors.length;
  const title = parseTitle(reader);
  const status = parseChoice(
    reader,
    "status",
    "todo",
    (text) => STATUS_ALIASES[text],
    "backlog, todo, progress, review or done"
  );
  const priority = parseChoice(
    reader,
    "priority",
    "none",
    (text) => PRIORITIES.find((candidate) => candidate === text),
    "urgent, high, medium, low or none"
  );
  const dueDate = parseDate(reader, "due_date");
  const startDate = parseDate(reader, "start_date");
  if (startDate && dueDate && startDate > dueDate) {
    errors.push({
      column: "start_date",
      line: reader.line,
      message: "The start date must be on or before the due date.",
    });
  }
  const assigneeEmails = parseAssignees(reader);
  const description = parseDescription(reader);
  if (errors.length > before) {
    return undefined;
  }
  return {
    assigneeEmails,
    description,
    dueDate,
    line: reader.line,
    priority,
    startDate,
    status,
    title,
  };
};

export const parseTaskImport = (text: string): TaskImportParse => {
  if (text.length > MAX_IMPORT_BYTES) {
    return fileError("The file is too large. Import at most 1 MB at a time.");
  }
  const parsed = parseCsv(text);
  if (!parsed.ok) {
    return fileError(parsed.message);
  }
  const [header, ...records] = parsed.rows;
  if (!header) {
    return fileError("The file is empty.");
  }
  const columns = header.map(canonicalColumn);
  if (!columns.includes("title")) {
    return fileError('Add a "title" column to the first row.');
  }
  const dataRecords = records.flatMap((cells, index) =>
    cells.some((cell) => cell.trim() !== "") ? [{ cells, line: index + 2 }] : []
  );
  if (dataRecords.length === 0) {
    return fileError("The file has no tasks below the header row.");
  }
  if (dataRecords.length > MAX_IMPORT_ROWS) {
    return fileError(
      `The file has more than ${MAX_IMPORT_ROWS} tasks. Split it into smaller files.`
    );
  }
  const errors: ImportRowError[] = [];
  const rows: ImportedTaskRow[] = [];
  for (const { cells, line } of dataRecords) {
    if (cells.length !== columns.length) {
      errors.push({
        column: null,
        line,
        message: `Expected ${columns.length} values but found ${cells.length}.`,
      });
      continue;
    }
    const reader: RowReader = {
      errors,
      line,
      read: (column) => readCell(cells[columns.indexOf(column)]),
    };
    const row = parseRow(reader, errors);
    if (row) {
      rows.push(row);
    }
  }
  return { errors, rows };
};
