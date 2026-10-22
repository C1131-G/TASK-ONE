import { expect, it } from "bun:test";

import {
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_OPTIONS,
  parseFieldDefinition,
} from "../../src/server/custom-fields/custom-field-definition";

const select = (options: string[]) =>
  parseFieldDefinition({ name: "Size", options, type: "select" });

it("trims the name and keeps no options for a non-select field", () => {
  expect(
    parseFieldDefinition({ name: "  Budget  ", options: [], type: "number" })
  ).toEqual({ name: "Budget", ok: true, options: null, type: "number" });
});

it("rejects an empty or over-long name", () => {
  expect(
    parseFieldDefinition({ name: "  ", options: [], type: "text" })
  ).toMatchObject({ field: "name", ok: false });
  expect(
    parseFieldDefinition({
      name: "n".repeat(MAX_FIELD_NAME_LENGTH + 1),
      options: [],
      type: "text",
    })
  ).toMatchObject({ field: "name", ok: false });
});

it("requires trimmed, unique options for a select, up to the limit", () => {
  expect(
    parseFieldDefinition({
      name: "Size",
      options: [" Small ", "Large"],
      type: "select",
    })
  ).toEqual({
    name: "Size",
    ok: true,
    options: ["Small", "Large"],
    type: "select",
  });
  expect(select([])).toMatchObject({ field: "options", ok: false });
  expect(select(["A", "a "])).toMatchObject({ field: "options", ok: false });
  expect(select(["A", ""])).toMatchObject({ field: "options", ok: false });
  expect(
    select(Array.from({ length: MAX_FIELD_OPTIONS }, (_, index) => `O${index}`))
  ).toMatchObject({ ok: true });
  expect(
    select(
      Array.from({ length: MAX_FIELD_OPTIONS + 1 }, (_, index) => `O${index}`)
    )
  ).toMatchObject({ field: "options", ok: false });
});

it("refuses options on a field that is not a select", () => {
  expect(
    parseFieldDefinition({ name: "Notes", options: ["A"], type: "text" })
  ).toMatchObject({ field: "options", ok: false });
});
