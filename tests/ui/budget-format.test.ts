import { expect, it } from "bun:test";

import {
  barWidth,
  formatMoney,
  hoursToMinutes,
  levelLabel,
  minutesToHours,
  parseRateToCents,
  periodLabel,
} from "@/features/projects/budget-format";

it("converts between hours and whole minutes", () => {
  expect(hoursToMinutes(10)).toBe(600);
  expect(hoursToMinutes(7.5)).toBe(450);
  expect(hoursToMinutes(0.01)).toBe(1);
  expect(minutesToHours(600)).toBe("10");
  expect(minutesToHours(450)).toBe("7.5");
  expect(minutesToHours(100)).toBe("1.67");
});

it("formats money from cents in the budget currency", () => {
  expect(formatMoney(90_000, "USD")).toBe("$900.00");
  expect(formatMoney(4550, "EUR")).toContain("45.50");
});

it("reads an hourly rate typed in currency units", () => {
  expect(parseRateToCents("")).toEqual({ cents: null, ok: true });
  expect(parseRateToCents("90")).toEqual({ cents: 9000, ok: true });
  expect(parseRateToCents("90.5")).toEqual({ cents: 9050, ok: true });
  expect(parseRateToCents("-1")).toEqual({ ok: false });
  expect(parseRateToCents("abc")).toEqual({ ok: false });
});

it("labels periods and levels in words, not colour alone", () => {
  expect(periodLabel("2026-10")).toBe("Oct 2026");
  expect(periodLabel("one-off")).toBe("All time");
  expect(levelLabel("ok")).toBe("On track");
  expect(levelLabel("warning")).toBe("Near the limit");
  expect(levelLabel("overrun")).toBe("Over budget");
});

it("keeps the burn bar inside its track", () => {
  expect(barWidth(-5)).toBe(0);
  expect(barWidth(42)).toBe(42);
  expect(barWidth(180)).toBe(100);
});
