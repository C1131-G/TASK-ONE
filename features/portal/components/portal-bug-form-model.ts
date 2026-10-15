import type { PortalImpact } from "@/features/portal/portal-format";
import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

export interface Step {
  readonly id: string;
  readonly text: string;
}

// Environment fields are null until the person edits them, so the detected
// browser value shows through without copying it into state.
export interface Values {
  readonly actual: string;
  readonly browser: string | null;
  readonly description: string;
  readonly device: string | null;
  readonly expected: string;
  readonly impact: PortalImpact | "";
  readonly os: string | null;
  readonly pageUrl: string;
  readonly projectId: string;
  readonly steps: readonly Step[];
  readonly title: string;
}

export type FieldKey =
  | "actual"
  | "expected"
  | "impact"
  | "pageUrl"
  | "projectId"
  | "steps"
  | "title";

export type Errors = Partial<Record<FieldKey, string>>;

export const FIELD_ORDER: readonly FieldKey[] = [
  "projectId",
  "title",
  "steps",
  "expected",
  "actual",
  "pageUrl",
  "impact",
];

export const LIMITS = {
  short: 500,
  steps: 30,
  text: 10_000,
  title: 300,
  url: 2000,
} as const;

export const emptyValues = (projectId: string): Values => ({
  actual: "",
  browser: null,
  description: "",
  device: null,
  expected: "",
  impact: "",
  os: null,
  pageUrl: "",
  projectId,
  steps: [{ id: "step-0", text: "" }],
  title: "",
});

export const valuesFromBug = (bug: PortalBugDetail): Values => ({
  actual: bug.actualBehavior,
  browser: bug.browser ?? "",
  description: bug.description ?? "",
  device: bug.device ?? "",
  expected: bug.expectedBehavior,
  impact: bug.impact ?? "",
  os: bug.os ?? "",
  pageUrl: bug.pageUrl,
  projectId: bug.projectId,
  steps: bug.reproductionSteps.map((text, index) => ({
    id: `step-${index}`,
    text,
  })),
  title: bug.title,
});

const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

export const validate = (values: Values, needsProject: boolean): Errors => {
  const errors: Errors = {};
  if (needsProject && !values.projectId) {
    errors.projectId = "Choose the project this bug is in.";
  }
  if (!values.title.trim()) {
    errors.title = "Give the bug a short title.";
  }
  if (!values.steps.some((step) => step.text.trim())) {
    errors.steps = "Add at least one step so we can reproduce it.";
  }
  if (!values.expected.trim()) {
    errors.expected = "Describe what you expected to happen.";
  }
  if (!values.actual.trim()) {
    errors.actual = "Describe what actually happened.";
  }
  if (!values.pageUrl.trim()) {
    errors.pageUrl = "Enter the address of the page where it happened.";
  } else if (!isHttpUrl(values.pageUrl.trim())) {
    errors.pageUrl = "Enter the full address, starting with https://";
  }
  if (!values.impact) {
    errors.impact = "Choose how much this affects you.";
  }
  return errors;
};

const orNull = (value: string | null) => value?.trim() || null;

const nonEmptySteps = (steps: readonly Step[]): string[] => {
  const texts: string[] = [];
  for (const step of steps) {
    const text = step.text.trim();
    if (text) {
      texts.push(text);
    }
  }
  return texts;
};

// The payload shared by report and edit.
export const toPayload = (
  values: Values,
  detected: { browser: string; device: string; os: string }
) => ({
  actualBehavior: values.actual.trim(),
  browser: orNull(values.browser ?? detected.browser),
  description: orNull(values.description),
  device: orNull(values.device ?? detected.device),
  expectedBehavior: values.expected.trim(),
  impact: values.impact,
  os: orNull(values.os ?? detected.os),
  pageUrl: values.pageUrl.trim(),
  reproductionSteps: nonEmptySteps(values.steps),
  title: values.title.trim(),
});
