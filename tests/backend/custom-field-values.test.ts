import { expect, it } from "bun:test";

import { parseFieldValue } from "../../src/server/custom-fields/custom-field-values";

const textField = { options: null, type: "text" } as const;

it("trims a text value and rejects empty or over-long text", () => {
  expect(parseFieldValue(textField, "  Hello  ")).toEqual({
    ok: true,
    value: "Hello",
  });
  expect(parseFieldValue(textField, "   ")).toMatchObject({ ok: false });
  expect(parseFieldValue(textField, "a".repeat(500))).toMatchObject({
    ok: true,
  });
  expect(parseFieldValue(textField, "a".repeat(501))).toMatchObject({
    ok: false,
  });
  expect(parseFieldValue(textField, 12)).toMatchObject({ ok: false });
});

it("accepts finite numbers within range and rejects everything else", () => {
  const field = { options: null, type: "number" } as const;
  expect(parseFieldValue(field, 12.5)).toEqual({ ok: true, value: 12.5 });
  expect(parseFieldValue(field, -3)).toEqual({ ok: true, value: -3 });
  expect(parseFieldValue(field, 0)).toEqual({ ok: true, value: 0 });
  expect(parseFieldValue(field, "12")).toMatchObject({ ok: false });
  expect(parseFieldValue(field, Number.NaN)).toMatchObject({ ok: false });
  expect(parseFieldValue(field, Number.POSITIVE_INFINITY)).toMatchObject({
    ok: false,
  });
  expect(parseFieldValue(field, 1e16)).toMatchObject({ ok: false });
});

it("accepts only one of a select field's options", () => {
  const field = { options: ["Small", "Large"], type: "select" } as const;
  expect(parseFieldValue(field, "Large")).toEqual({ ok: true, value: "Large" });
  expect(parseFieldValue(field, "Medium")).toMatchObject({ ok: false });
  expect(parseFieldValue(field, "large")).toMatchObject({ ok: false });
  expect(parseFieldValue(field, 1)).toMatchObject({ ok: false });
});

it("accepts a real calendar date and rejects other date text", () => {
  const field = { options: null, type: "date" } as const;
  expect(parseFieldValue(field, "2026-02-28")).toEqual({
    ok: true,
    value: "2026-02-28",
  });
  expect(parseFieldValue(field, "2026-02-30")).toMatchObject({ ok: false });
  expect(parseFieldValue(field, "28/02/2026")).toMatchObject({ ok: false });
  expect(parseFieldValue(field, 20_260_228)).toMatchObject({ ok: false });
});

it("accepts true or false for a checkbox and nothing else", () => {
  const field = { options: null, type: "checkbox" } as const;
  expect(parseFieldValue(field, true)).toEqual({ ok: true, value: true });
  expect(parseFieldValue(field, false)).toEqual({ ok: true, value: false });
  expect(parseFieldValue(field, "true")).toMatchObject({ ok: false });
  expect(parseFieldValue(field, 1)).toMatchObject({ ok: false });
});
