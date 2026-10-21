import { expect, it } from "bun:test";

import {
  formatClock,
  formatMinutes,
  parseDuration,
  shiftWeek,
  weekLabel,
} from "../../features/time/time-format";

it("writes minutes as hours and minutes", () => {
  expect(formatMinutes(0)).toBe("0m");
  expect(formatMinutes(45)).toBe("45m");
  expect(formatMinutes(60)).toBe("1h");
  expect(formatMinutes(90)).toBe("1h 30m");
  expect(formatMinutes(1440)).toBe("24h");
});

it("reads durations typed as 1h 30m, 1:30, 1.5h or plain minutes", () => {
  expect(parseDuration("90")).toBe(90);
  expect(parseDuration("1h 30m")).toBe(90);
  expect(parseDuration("1h")).toBe(60);
  expect(parseDuration("45m")).toBe(45);
  expect(parseDuration("1:30")).toBe(90);
  expect(parseDuration("1.5h")).toBe(90);
  expect(parseDuration(" 2H ")).toBe(120);
});

it("rejects durations it cannot read or that are out of range", () => {
  for (const text of ["", "abc", "0", "-5", "1441", "25h", "1:75", "1.5"]) {
    expect(parseDuration(text), text).toBeNull();
  }
});

it("moves between weeks and labels them", () => {
  expect(shiftWeek("2026-10-19", 1)).toBe("2026-10-26");
  expect(shiftWeek("2026-10-19", -1)).toBe("2026-10-12");
  expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
  expect(weekLabel("2026-10-19")).toBe("19 Oct - 25 Oct 2026");
  expect(weekLabel("2026-12-28")).toBe("28 Dec 2026 - 3 Jan 2027");
});

it("writes a running timer as a clock", () => {
  expect(formatClock(0)).toBe("00:00:00");
  expect(formatClock(5)).toBe("00:00:05");
  expect(formatClock(3725)).toBe("01:02:05");
  expect(formatClock(100 * 3600)).toBe("100:00:00");
});
