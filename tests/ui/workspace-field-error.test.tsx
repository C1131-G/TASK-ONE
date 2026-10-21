import { expect, test } from "bun:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import { NO_FORM_ERRORS, fieldErrorId } from "@/lib/field-errors";

const errors = {
  fields: { title: "Enter a title." },
  form: "You can't edit this event.",
};

test("a field error is announced and tied to its field by id", () => {
  const markup = renderToStaticMarkup(
    createElement(WorkspaceFieldError, {
      errors,
      field: "title",
      formId: "event",
    })
  );

  expect(markup).toContain('role="alert"');
  expect(markup).toContain(`id="${fieldErrorId("event", "title")}"`);
  expect(markup).toContain("Enter a title.");
});

test("a field without an error renders nothing", () => {
  const markup = renderToStaticMarkup(
    createElement(WorkspaceFieldError, {
      errors,
      field: "location",
      formId: "event",
    })
  );

  expect(markup).toBe("");
});

test("a form level error is announced and clears when there is none", () => {
  const shown = renderToStaticMarkup(
    createElement(WorkspaceFormError, { errors })
  );
  const cleared = renderToStaticMarkup(
    createElement(WorkspaceFormError, { errors: NO_FORM_ERRORS })
  );

  expect(shown).toContain('role="alert"');
  expect(shown).toContain("You can&#x27;t edit this event.");
  expect(cleared).toBe("");
});
