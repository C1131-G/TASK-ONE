import { expect, it } from "bun:test";

import { Schema } from "effect";

import { BugReportInputSchema } from "../../src/server/work/bug-contracts";
import type { BugReportInput } from "../../src/server/work/bug-contracts";

const validReport: BugReportInput = {
  actualBehavior: "The save button returns a 500 response.",
  appVersion: "1.2.0",
  browser: "Firefox 132",
  component: "ProjectSettingsForm",
  description: "Saving a changed project name fails.",
  device: "Desktop",
  discoverySource: "internal_qa",
  environment: "staging",
  expectedBehavior: "The project name is saved and shown in the header.",
  os: "Windows 11",
  projectId: "454cdfa4-5680-4a3f-a87f-5f4795d14960",
  reproductionSteps: ["Open project settings", "Change name", "Select Save"],
  route: "/projects/alpha/settings",
  severity: "major",
  title: "Project settings cannot be saved",
};

it("accepts complete structured bug discovery details", () => {
  expect(Schema.decodeUnknownSync(BugReportInputSchema)(validReport)).toEqual(
    validReport
  );
});

it("rejects a report without actual behavior", () => {
  expect(() =>
    Schema.decodeUnknownSync(BugReportInputSchema)({
      ...validReport,
      actualBehavior: "   ",
    })
  ).toThrow();
});

it("rejects a report without reproduction steps", () => {
  expect(() =>
    Schema.decodeUnknownSync(BugReportInputSchema)({
      ...validReport,
      reproductionSteps: [],
    })
  ).toThrow();
});
