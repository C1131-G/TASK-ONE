import { describe, expect, it } from "bun:test";

import { Effect, Schema } from "effect";

import { validateEvent } from "../../src/server/calendar/calendar-validation";
import { CreateClientCompanyInputSchema } from "../../src/server/clients/client-company-contracts";
import { AppError, runEffectResult } from "../../src/server/core/action-result";
import { CalendarDateSchema } from "../../src/server/core/input-schemas";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "../../src/server/core/server-action";
import { validatePerson } from "../../src/server/people/user-internal";
import { validateCreateProjectInput } from "../../src/server/projects/project-internal";
import { validateInput as validateTaskInput } from "../../src/server/work/work-internal";

const fieldOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) {
      return error.field;
    }
    throw error;
  }
  return undefined;
};

const neverRuns = () => Effect.succeed("ran");

describe("action field errors", () => {
  it("reports the field a service names alongside the message", async () => {
    const result = await runEffectResult(
      Effect.fail(
        new AppError({
          code: "VALIDATION_FAILED",
          field: "title",
          message: "Enter a title.",
        })
      ),
      "req-field-001"
    );

    expect(result).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        fieldErrors: { title: "Enter a title." },
        message: "Enter a title.",
        requestId: "req-field-001",
      },
      ok: false,
    });
  });

  it("maps input that fails its schema to the failing fields", async () => {
    const result = await runServerAction(
      { dueDate: "2026-13-40", title: 42 },
      Schema.Struct({ dueDate: CalendarDateSchema, title: Schema.String }),
      neverRuns,
      "req-field-002",
      ServerActionOutputSchema
    );

    expect(result).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        fieldErrors: {
          dueDate: "Enter a valid calendar date.",
          title: "Enter a valid value.",
        },
        message: "The request data is invalid.",
        requestId: "req-field-002",
      },
      ok: false,
    });
  });

  it("names the company name field when it is blank", async () => {
    const result = await runServerAction(
      { name: "   " },
      CreateClientCompanyInputSchema,
      neverRuns,
      "req-field-003",
      ServerActionOutputSchema
    );

    expect(result.ok ? undefined : result.error.fieldErrors).toEqual({
      name: "Enter a company name between 1 and 160 characters.",
    });
  });
});

describe("service validation names its field", () => {
  const event = {
    attendeeIds: [],
    description: null,
    endsAt: null,
    location: null,
    projectId: null,
    startsAt: new Date("2026-10-20T09:00:00Z"),
    title: "Review",
  };

  it("calendar events", () => {
    expect(fieldOf(() => validateEvent({ ...event, title: " " }))).toBe(
      "title"
    );
    expect(
      fieldOf(() =>
        validateEvent({ ...event, endsAt: new Date("2026-10-20T08:00:00Z") })
      )
    ).toBe("endsAt");
    expect(
      fieldOf(() => validateEvent({ ...event, location: "x".repeat(301) }))
    ).toBe("location");
  });

  it("projects", () => {
    const project = {
      color: "#4b5bd6",
      description: null,
      key: "WEB",
      name: "Website",
      status: "planning",
      teamId: null,
    } as const;
    expect(
      fieldOf(() => validateCreateProjectInput({ ...project, key: "w" }))
    ).toBe("key");
    expect(
      fieldOf(() => validateCreateProjectInput({ ...project, name: " " }))
    ).toBe("name");
  });

  it("people", () => {
    expect(fieldOf(() => validatePerson("a@b.co", " ", null))).toBe("name");
    expect(fieldOf(() => validatePerson("nope", "Ada", null))).toBe("email");
    expect(
      fieldOf(() => validatePerson("a@b.co", "Ada", "x".repeat(121)))
    ).toBe("jobTitle");
  });

  it("tasks", () => {
    const task = {
      assigneeIds: [],
      description: null,
      dueDate: null,
      priority: "none",
      projectId: "9d0a4a2e-6c1f-4f7e-9b1a-1b2c3d4e5f60",
      status: "todo",
      title: "Write copy",
    } as const;
    expect(fieldOf(() => validateTaskInput({ ...task, title: " " }))).toBe(
      "title"
    );
    expect(
      fieldOf(() => validateTaskInput({ ...task, dueDate: "2026-02-30" }))
    ).toBe("dueDate");
  });
});
