import { expect, test } from "bun:test";

import {
  projectViewSearchToSettings,
  projectViewSettingsToSearch,
  readProjectViewSearch,
  toRawProjectViewSearch,
} from "../../features/projects/project-view-search";
import {
  GLOBAL_HIDEABLE_COLUMNS,
  HIDEABLE_COLUMNS,
  MAX_CUSTOM_FIELD_COLUMNS,
  clampColumnWidth,
  columnWidthsFromPreferences,
  customFieldColumn,
  customFieldColumnId,
  defaultColumnWidth,
  dropInactiveCustomColumns,
  shownColumns,
  parseCustomFieldColumnId,
  parseHiddenColumns,
  serializeHiddenColumns,
} from "../../features/tasks/task-table-columns";

const FIELD_ID = "0b8f3c1e-5d2a-4c7e-9a41-6f1d2e3a4b5c";

test("a custom field column id round-trips through its field id", () => {
  expect(customFieldColumnId(FIELD_ID)).toBe(`cf:${FIELD_ID}`);
  expect(parseCustomFieldColumnId(`cf:${FIELD_ID}`)).toBe(FIELD_ID);
});

test("ids that are not a well formed custom field column parse to nothing", () => {
  for (const id of [
    "",
    "cf:",
    "cf:nope",
    `cf:${FIELD_ID}x`,
    `CF:${FIELD_ID}`,
    `cf:${FIELD_ID.toUpperCase()}`,
    FIELD_ID,
    "due",
  ]) {
    expect(parseCustomFieldColumnId(id)).toBeUndefined();
  }
});

const OTHER_ID = "11111111-2222-4333-8444-555555555555";

test("the project table keeps well formed custom columns after the built-ins", () => {
  const parsed = parseHiddenColumns(
    `cf:${OTHER_ID},due,cf:nope,cf:${FIELD_ID},cf:${FIELD_ID},actions`,
    HIDEABLE_COLUMNS,
    { customFields: true }
  );
  expect(parsed).toEqual(["due", `cf:${FIELD_ID}`, `cf:${OTHER_ID}`]);
  expect(
    serializeHiddenColumns(parsed, HIDEABLE_COLUMNS, { customFields: true })
  ).toBe(`due,cf:${FIELD_ID},cf:${OTHER_ID}`);
});

test("global tables and the default parse drop custom columns", () => {
  const value = `due,cf:${FIELD_ID}`;
  expect(parseHiddenColumns(value)).toEqual(["due"]);
  expect(parseHiddenColumns(value, GLOBAL_HIDEABLE_COLUMNS)).toEqual(["due"]);
  expect(serializeHiddenColumns(["due", `cf:${FIELD_ID}`])).toBe("due");
});

test("custom column widths clamp, and stored widths keep only active fields", () => {
  const id = customFieldColumnId(FIELD_ID);
  expect(clampColumnWidth(id, 10)).toBe(100);
  expect(defaultColumnWidth(id)).toBe(160);
  expect(
    columnWidthsFromPreferences(
      {
        [id]: 300,
        [customFieldColumnId(OTHER_ID)]: 300,
        "cf:nope": 300,
        due: 140,
      },
      [FIELD_ID]
    )
  ).toEqual({ [id]: 300, due: 140 });
  expect(columnWidthsFromPreferences({ [id]: 300, due: 140 })).toEqual({
    due: 140,
  });
});

const fieldA = { id: FIELD_ID, name: "Client ref" };
const fieldB = { id: OTHER_ID, name: "Budget" };

test("custom columns are off by default and appear only when toggled on", () => {
  const columns = [customFieldColumn(fieldA), customFieldColumn(fieldB)];
  expect(shownColumns(columns, [])).toHaveLength(0);
  expect(
    shownColumns(columns, [customFieldColumnId(OTHER_ID), "due"]).map(
      ({ label }) => label
    )
  ).toEqual(["Budget"]);
  const builtIn = HIDEABLE_COLUMNS.filter(({ id }) => id === "due");
  expect(shownColumns(builtIn, ["due"])).toHaveLength(0);
  expect(shownColumns(builtIn, [])).toHaveLength(1);
});

test("custom columns of archived or unknown fields are dropped from a hidden list", () => {
  expect(
    dropInactiveCustomColumns(
      ["due", customFieldColumnId(FIELD_ID), customFieldColumnId(OTHER_ID)],
      [OTHER_ID]
    )
  ).toEqual(["due", customFieldColumnId(OTHER_ID)]);
});

test("project view search carries custom columns through the URL and saved views", () => {
  const column = customFieldColumnId(FIELD_ID);
  const params = new URLSearchParams({
    hidden: `due,${column},cf:bogus`,
  });
  const search = readProjectViewSearch(params);
  expect(search.hidden).toEqual(["due", column]);
  expect(toRawProjectViewSearch(search).hidden).toBe(`due,${column}`);

  const settings = projectViewSearchToSettings(search);
  expect(settings.hiddenColumns).toEqual(["due", column]);
  expect(
    projectViewSettingsToSearch({
      ...settings,
      hiddenColumns: ["estimate", column, "cf:old", "task"],
    }).hidden
  ).toEqual(["estimate", column]);
});

test("only as many custom columns as a project may have fields are kept", () => {
  const ids = Array.from(
    { length: MAX_CUSTOM_FIELD_COLUMNS + 3 },
    (_, index) =>
      `cf:00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
  );
  expect(
    parseHiddenColumns(ids.join(","), HIDEABLE_COLUMNS, { customFields: true })
  ).toHaveLength(MAX_CUSTOM_FIELD_COLUMNS);
});
