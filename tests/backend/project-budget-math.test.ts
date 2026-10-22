import { expect, it } from "bun:test";

import {
  budgetPeriod,
  burnOf,
  companyToday,
} from "../../src/server/budgets/budget-math";

const monthEnd = (iso: string) =>
  budgetPeriod("retainer", new Date(iso), "UTC").to;

it("uses the company calendar day, not the UTC day", () => {
  const instant = new Date("2026-10-31T20:30:00.000Z");
  expect(companyToday(instant, "UTC")).toBe("2026-10-31");
  expect(companyToday(instant, "Asia/Kolkata")).toBe("2026-11-01");
  expect(companyToday(instant, "America/Los_Angeles")).toBe("2026-10-31");
});

it("resets a retainer on the first of the company month", () => {
  const lastSecond = new Date("2026-10-31T18:29:59.000Z");
  const firstSecond = new Date("2026-10-31T18:30:00.000Z");
  expect(budgetPeriod("retainer", lastSecond, "Asia/Kolkata")).toEqual({
    from: "2026-10-01",
    key: "2026-10",
    to: "2026-10-31",
  });
  expect(budgetPeriod("retainer", firstSecond, "Asia/Kolkata")).toEqual({
    from: "2026-11-01",
    key: "2026-11",
    to: "2026-11-30",
  });
});

it("knows month lengths including leap-year February and year ends", () => {
  expect(monthEnd("2028-02-10T00:00:00Z")).toBe("2028-02-29");
  expect(monthEnd("2027-02-10T00:00:00Z")).toBe("2027-02-28");
  expect(monthEnd("2026-12-31T23:59:59Z")).toBe("2026-12-31");
  expect(
    budgetPeriod("retainer", new Date("2026-12-31T23:59:59Z"), "UTC").key
  ).toBe("2026-12");
});

it("counts a one-off budget over all time under a single key", () => {
  expect(
    budgetPeriod("one_off", new Date("2026-10-31T20:30:00Z"), "UTC")
  ).toEqual({ from: null, key: "one-off", to: null });
});

it("measures burn, remaining and level against the threshold", () => {
  expect(
    burnOf({ budgetMinutes: 600, spentMinutes: 0, warningPercent: 80 })
  ).toEqual({ level: "ok", percent: 0, remainingMinutes: 600 });
  expect(
    burnOf({ budgetMinutes: 600, spentMinutes: 479, warningPercent: 80 }).level
  ).toBe("ok");
  expect(
    burnOf({ budgetMinutes: 600, spentMinutes: 480, warningPercent: 80 })
  ).toEqual({ level: "warning", percent: 80, remainingMinutes: 120 });
  expect(
    burnOf({ budgetMinutes: 600, spentMinutes: 600, warningPercent: 80 }).level
  ).toBe("warning");
  expect(
    burnOf({ budgetMinutes: 600, spentMinutes: 660, warningPercent: 80 })
  ).toEqual({ level: "overrun", percent: 110, remainingMinutes: -60 });
});
