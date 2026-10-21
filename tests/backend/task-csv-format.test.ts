import { expect, it } from "bun:test";

import {
  escapeCsvCell,
  formatCsv,
  parseCsv,
  parseTaskImport,
} from "../../src/server/tasks/csv";

it("neutralises spreadsheet formulas by prefixing risky leading characters", () => {
  expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
  expect(escapeCsvCell("+1")).toBe("'+1");
  expect(escapeCsvCell("-2")).toBe("'-2");
  expect(escapeCsvCell("@cmd")).toBe("'@cmd");
  expect(escapeCsvCell("\tTabbed")).toBe("'\tTabbed");
  expect(escapeCsvCell("Plain = text")).toBe("Plain = text");
});

it("quotes cells holding commas, quotes and line breaks", () => {
  expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  expect(escapeCsvCell("a,b")).toBe('"a,b"');
  expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  expect(escapeCsvCell('=HYPERLINK("x","y")')).toBe(
    '"\'=HYPERLINK(""x"",""y"")"'
  );
  expect(escapeCsvCell(null)).toBe("");
  expect(escapeCsvCell(7)).toBe("7");
});

it("formats rows with CRLF endings", () => {
  expect(
    formatCsv([
      ["a", "b,c"],
      ["1", null],
    ])
  ).toBe('a,"b,c"\r\n1,\r\n');
});

it("parses quoted fields, embedded newlines and a leading byte order mark", () => {
  const parsed = parseCsv('﻿a,"b,c"\r\n"x ""y""","l1\nl2"\n');
  expect(parsed).toEqual({
    ok: true,
    rows: [
      ["a", "b,c"],
      ['x "y"', "l1\nl2"],
    ],
  });
});

it("reports an unterminated quote", () => {
  const parsed = parseCsv('a,"b\n');
  expect(parsed.ok).toBe(false);
});

it("round-trips escaped cells through the parser and importer", () => {
  const titles = ["=1+1", 'He said "go"', "multi\nline", "plain"];
  const text = formatCsv([
    ["title", "status"],
    ...titles.map((title) => [title, "todo"]),
  ]);
  const result = parseTaskImport(text);
  expect(result.errors).toEqual([]);
  expect(result.rows.map(({ title }) => title)).toEqual(titles);
});

it("maps imported rows with defaults and aliases", () => {
  const result = parseTaskImport(
    "Title,Status,Priority,Due Date,Start Date,Assignees,Description\r\n" +
      "Write docs,In Progress,HIGH,2026-03-04,2026-03-01,a@x.com; B@x.com,Hello\r\n" +
      "Bare,,,,,,\r\n"
  );
  expect(result.errors).toEqual([]);
  expect(result.rows).toEqual([
    {
      assigneeEmails: ["a@x.com", "b@x.com"],
      description: "Hello",
      dueDate: "2026-03-04",
      line: 2,
      priority: "high",
      startDate: "2026-03-01",
      status: "progress",
      title: "Write docs",
    },
    {
      assigneeEmails: [],
      description: null,
      dueDate: null,
      line: 3,
      priority: "none",
      startDate: null,
      status: "todo",
      title: "Bare",
    },
  ]);
});

it("reports every invalid row with its line and column", () => {
  const result = parseTaskImport(
    "title,status,priority,due_date,start_date,assignees\n" +
      ",todo,none,,,\n" +
      "Ok,sideways,none,,,\n" +
      "Ok,todo,huge,,,\n" +
      "Ok,todo,none,2026-02-30,,\n" +
      "Ok,todo,none,2026-05-01,2026-06-01,\n" +
      "Ok,todo,none,,,not-an-email\n" +
      "Fine,todo,none,,,\n"
  );
  expect(result.rows.map(({ line }) => line)).toEqual([8]);
  expect(result.errors.map(({ column, line }) => [line, column])).toEqual([
    [2, "title"],
    [3, "status"],
    [4, "priority"],
    [5, "due_date"],
    [6, "start_date"],
    [7, "assignees"],
  ]);
});

it("requires a title column and rejects an empty file", () => {
  expect(parseTaskImport("status\ntodo\n").errors[0]?.line).toBe(1);
  expect(parseTaskImport("").errors[0]?.line).toBe(1);
  expect(parseTaskImport("title\n").errors[0]?.message).toContain("no tasks");
});

it("rejects rows with the wrong number of cells", () => {
  const result = parseTaskImport("title,status\nA,todo,extra\n");
  expect(result.errors[0]).toMatchObject({ line: 2 });
});

it("caps the number of rows and the file size", () => {
  const many = `title\n${Array.from({ length: 501 }, (_, index) => `T${index}`).join("\n")}\n`;
  expect(parseTaskImport(many).errors[0]?.message).toContain("500");
  const huge = `title\n${"x".repeat(1_100_000)}\n`;
  expect(parseTaskImport(huge).errors[0]?.message).toContain("too large");
});
