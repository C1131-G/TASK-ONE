import { expect, test } from "bun:test";

import { formatCustomFieldValue } from "../../features/custom-fields/custom-field-format";

test("a task with no value shows a dash whatever the type", () => {
  for (const type of [
    "text",
    "number",
    "select",
    "date",
    "checkbox",
  ] as const) {
    expect(formatCustomFieldValue(type)).toBe("—");
    expect(formatCustomFieldValue(type, null)).toBe("—");
  }
});

test("values read according to their type", () => {
  expect(formatCustomFieldValue("text", "ACME-42")).toBe("ACME-42");
  expect(formatCustomFieldValue("select", "High risk")).toBe("High risk");
  expect(formatCustomFieldValue("number", 1234.5)).toBe("1,234.5");
  expect(formatCustomFieldValue("number", 0)).toBe("0");
  expect(formatCustomFieldValue("date", "2026-03-09")).toBe("Mar 9, 2026");
  expect(formatCustomFieldValue("checkbox", true)).toBe("Yes");
  expect(formatCustomFieldValue("checkbox", false)).toBe("No");
});

test("a stored value of the wrong shape shows a dash instead of throwing", () => {
  expect(formatCustomFieldValue("number", "abc")).toBe("—");
  expect(formatCustomFieldValue("date", "not a date")).toBe("—");
  expect(formatCustomFieldValue("checkbox", "yes")).toBe("—");
});
