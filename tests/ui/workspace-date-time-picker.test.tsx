import { expect, test } from "bun:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceDateTimePicker } from "@/components/workspace/workspace-date-time-picker";

test("date-time picker renders an accessible label and preserves local form value", () => {
  const markup = renderToStaticMarkup(
    createElement(WorkspaceDateTimePicker, {
      ariaLabel: "Choose event start date and time",
      defaultValue: "2026-10-12T09:20",
      id: "event-start",
      name: "startsAt",
      required: true,
    })
  );

  expect(markup).toContain('aria-label="Choose event start date and time"');
  expect(markup).toContain('aria-required="true"');
  expect(markup).toContain('name="startsAt"');
  expect(markup).toContain('value="2026-10-12T09:20"');
  expect(markup).toContain("Oct 12, 2026 · 9:20 AM");
});

test("optional date-time picker serializes an empty value", () => {
  const markup = renderToStaticMarkup(
    createElement(WorkspaceDateTimePicker, {
      ariaLabel: "Choose event end date and time",
      id: "event-end",
      name: "endsAt",
    })
  );

  expect(markup).toContain('name="endsAt"');
  expect(markup).toContain('value=""');
  expect(markup).toContain("Pick date and time");
});
