import { describe, expect, it } from "bun:test";

import {
  NO_FORM_ERRORS,
  fieldErrorId,
  fieldErrorProps,
  firstErrorField,
  formErrorsFrom,
} from "../../lib/field-errors";

const EVENT_FIELDS = ["title", "startsAt", "endsAt", "location"] as const;

describe("formErrorsFrom", () => {
  it("shows a field error inline and keeps the form message clear", () => {
    const errors = formErrorsFrom(
      {
        fieldErrors: { endsAt: "Choose an end time after the start." },
        message: "Choose an end time after the start.",
      },
      EVENT_FIELDS
    );
    expect(errors).toEqual({
      fields: { endsAt: "Choose an end time after the start." },
      form: undefined,
    });
  });

  it("keeps the message at form level when no shown field matches", () => {
    expect(
      formErrorsFrom(
        {
          fieldErrors: { attendeeIds: "Invalid event attendees." },
          message: "Invalid event attendees.",
        },
        EVENT_FIELDS
      )
    ).toEqual({ fields: {}, form: "Invalid event attendees." });
    expect(
      formErrorsFrom({ message: "Only administrators can do that." }, [])
    ).toEqual({ fields: {}, form: "Only administrators can do that." });
  });
});

describe("fieldErrorProps", () => {
  it("marks an invalid field and points it at its error", () => {
    const errors = { fields: { title: "Enter a title." }, form: undefined };
    expect(fieldErrorProps(errors, "event", "title")).toEqual({
      "aria-describedby": "event-title-error",
      "aria-invalid": true,
    });
    expect(fieldErrorId("event", "title")).toBe("event-title-error");
  });

  it("keeps a hint and leaves a valid field unmarked", () => {
    expect(fieldErrorProps(NO_FORM_ERRORS, "event", "title", "hint")).toEqual({
      "aria-describedby": "hint",
      "aria-invalid": undefined,
    });
  });
});

describe("firstErrorField", () => {
  it("returns the first invalid field in form order", () => {
    const errors = {
      fields: { endsAt: "After the start.", title: "Enter a title." },
      form: undefined,
    };
    expect(firstErrorField(errors, EVENT_FIELDS)).toBe("title");
    expect(firstErrorField(NO_FORM_ERRORS, EVENT_FIELDS)).toBeUndefined();
  });
});
