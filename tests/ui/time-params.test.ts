import { expect, it } from "bun:test";

import {
  parseDateParam,
  projectReportRange,
} from "../../features/time/time-params";

it("accepts only real calendar dates from the URL", () => {
  expect(parseDateParam("2026-10-19")).toBe("2026-10-19");
  expect(parseDateParam("2026-02-30")).toBeNull();
  expect(parseDateParam("19-10-2026")).toBeNull();
  expect(parseDateParam(["2026-10-19"])).toBeNull();
  expect(parseDateParam()).toBeNull();
});

it("defaults the project report to the last 30 days and repairs a backwards range", () => {
  expect(projectReportRange(undefined, undefined, "2026-10-21")).toEqual({
    from: "2026-09-21",
    to: "2026-10-21",
  });
  expect(projectReportRange("2026-10-01", "2026-10-10", "2026-10-21")).toEqual({
    from: "2026-10-01",
    to: "2026-10-10",
  });
  expect(projectReportRange("2026-10-10", "2026-10-01", "2026-10-21")).toEqual({
    from: "2026-10-01",
    to: "2026-10-10",
  });
  expect(projectReportRange("nope", "2026-10-10", "2026-10-21")).toEqual({
    from: "2026-09-10",
    to: "2026-10-10",
  });
});
