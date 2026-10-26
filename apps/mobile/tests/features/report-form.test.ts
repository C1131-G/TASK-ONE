import { expect, it } from "vitest";

import { draftToReport, EMPTY_REPORT_DRAFT, type ReportDraft } from "@/features/portal/report-form";

const PROJECT = "5a1d9c42-6b7e-4f30-8c2d-9e4b1a7f3c05";

const valid: ReportDraft = {
  actual: "The page shows a spinner forever",
  expected: "The dashboard opens",
  impact: "high",
  pageUrl: "https://app.example.com/dashboard",
  projectId: PROJECT,
  steps: "Sign in\nOpen the dashboard\n",
  title: "Dashboard never loads",
};

it("turns a complete draft into the report body, one step per line", () => {
  const result = draftToReport(valid);

  expect(result).toEqual({
    body: {
      actualBehavior: "The page shows a spinner forever",
      browser: null,
      description: null,
      device: null,
      expectedBehavior: "The dashboard opens",
      impact: "high",
      os: null,
      pageUrl: "https://app.example.com/dashboard",
      projectId: PROJECT,
      reproductionSteps: ["Sign in", "Open the dashboard"],
      title: "Dashboard never loads",
    },
    ok: true,
  });
});

it("trims every field and drops blank step lines", () => {
  const result = draftToReport({ ...valid, steps: "  one  \n\n   \n two ", title: "  Padded title  " });

  expect(result.ok && result.body.reproductionSteps).toEqual(["one", "two"]);
  expect(result.ok && result.body.title).toBe("Padded title");
});

it("names every missing required field", () => {
  const result = draftToReport(EMPTY_REPORT_DRAFT);

  expect(result.ok).toBe(false);
  expect(!result.ok && Object.keys(result.fieldErrors).toSorted()).toEqual([
    "actual",
    "expected",
    "pageUrl",
    "projectId",
    "steps",
    "title",
  ]);
});

it("rejects a title that is too short or too long", () => {
  expect(draftToReport({ ...valid, title: "No" }).ok).toBe(false);
  expect(draftToReport({ ...valid, title: "x".repeat(301) }).ok).toBe(false);
});

it("rejects more than thirty steps", () => {
  const steps = Array.from({ length: 31 }, (_, index) => `step ${index}`).join("\n");

  const result = draftToReport({ ...valid, steps });

  expect(!result.ok && result.fieldErrors.steps).toBe("Use at most 30 steps");
});
