import { expect, it } from "bun:test";

import {
  MAX_REFERENCES_PER_PULL,
  extractTaskNumbers,
  sanitizePullTitle,
} from "../../src/server/github/github-references";

it("finds the project key in a title, branch and body", () => {
  expect(
    extractTaskNumbers("MET", [
      "MET-12 add login",
      "feature/met-34-login",
      "Closes MET-56.",
    ])
  ).toEqual([12, 34, 56]);
});

it("ignores other project keys, partial matches and bare numbers", () => {
  expect(
    extractTaskNumbers("MET", [
      "OTHER-1 and XMET-2 and MET-3x and MET-4a1 and #5 and MET_6 and MET-",
    ])
  ).toEqual([]);
});

it("accepts punctuation around a key and returns each number once", () => {
  expect(
    extractTaskNumbers("MET", ["(MET-7), [met-7] MET-7/MET-8: fix"])
  ).toEqual([7, 8]);
});

it("ignores null texts, zero and absurdly large numbers", () => {
  expect(
    extractTaskNumbers("MET", [null, undefined, "MET-0 MET-99999999999"])
  ).toEqual([]);
});

it("caps the number of references taken from one pull request", () => {
  const body = Array.from(
    { length: 50 },
    (_, index) => `MET-${index + 1}`
  ).join(" ");
  expect(extractTaskNumbers("MET", [body])).toHaveLength(
    MAX_REFERENCES_PER_PULL
  );
});

it("does not treat regular-expression characters in a key as syntax", () => {
  expect(extractTaskNumbers("A.B", ["AXB-1 A.B-2"])).toEqual([2]);
});

it("keeps display titles to plain text of a bounded length", () => {
  expect(sanitizePullTitle("  Fix\u0000 the‮ bug\n now  ")).toBe(
    "Fix the bug now"
  );
  expect(sanitizePullTitle("x".repeat(1000))).toHaveLength(300);
  expect(sanitizePullTitle("   ")).toBe("Untitled pull request");
  expect(sanitizePullTitle('<img src=x onerror="alert(1)">')).toBe(
    '<img src=x onerror="alert(1)">'
  );
});
