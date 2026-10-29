/**
 * The bug report a client fills in, checked before anything is sent. The
 * server holds the same limits (title 300 characters, 1 to 30 steps), so a
 * passing draft is accepted; an incomplete one names each field to fix.
 */

export type ReportImpact = "high" | "low" | "medium" | "urgent";

export const REPORT_IMPACTS: readonly ReportImpact[] = ["low", "medium", "high", "urgent"];

export interface ReportDraft {
  readonly actual: string;
  readonly expected: string;
  readonly impact: ReportImpact;
  readonly pageUrl: string;
  readonly projectId: string;
  /** One step per line. */
  readonly steps: string;
  readonly title: string;
}

export const EMPTY_REPORT_DRAFT: ReportDraft = {
  actual: "",
  expected: "",
  impact: "medium",
  pageUrl: "",
  projectId: "",
  steps: "",
  title: "",
};

export interface ReportBody {
  readonly actualBehavior: string;
  readonly browser: string | null;
  readonly description: string | null;
  readonly device: string | null;
  readonly expectedBehavior: string;
  readonly impact: ReportImpact;
  readonly os: string | null;
  readonly pageUrl: string;
  readonly projectId: string;
  readonly reproductionSteps: readonly string[];
  readonly title: string;
}

export type ReportResult =
  | { readonly body: ReportBody; readonly ok: true }
  | { readonly fieldErrors: Readonly<Record<string, string>>; readonly ok: false };

const MIN_TITLE = 4;
const MAX_TITLE = 300;
const MAX_STEPS = 30;
const MAX_TEXT = 10_000;
const MAX_URL = 2000;

const stepsOf = (text: string): readonly string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const requiredText = (value: string, message: string, max = MAX_TEXT): string | null => {
  if (value.length === 0) {
    return message;
  }
  return value.length > max ? `Keep this under ${max} characters` : null;
};

/** Checks a draft and builds the request body, or lists what to fix. */
export const draftToReport = (draft: ReportDraft): ReportResult => {
  const title = draft.title.trim();
  const expected = draft.expected.trim();
  const actual = draft.actual.trim();
  const pageUrl = draft.pageUrl.trim();
  const steps = stepsOf(draft.steps);

  const checks: readonly (readonly [string, string | null])[] = [
    [
      "title",
      title.length < MIN_TITLE || title.length > MAX_TITLE
        ? `Give the problem a title of ${MIN_TITLE} to ${MAX_TITLE} characters`
        : null,
    ],
    ["expected", requiredText(expected, "Say what you expected to happen")],
    ["actual", requiredText(actual, "Say what happened instead")],
    [
      "steps",
      steps.length === 0
        ? "List at least one step"
        : steps.length > MAX_STEPS
          ? `Use at most ${MAX_STEPS} steps`
          : null,
    ],
    ["pageUrl", requiredText(pageUrl, "Say which page it happened on", MAX_URL)],
    ["projectId", draft.projectId.length === 0 ? "Choose a project" : null],
  ];

  const fieldErrors = Object.fromEntries(
    checks.flatMap(([field, message]) => (message === null ? [] : [[field, message] as const])),
  );
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, ok: false };
  }

  return {
    body: {
      actualBehavior: actual,
      browser: null,
      description: null,
      device: null,
      expectedBehavior: expected,
      impact: draft.impact,
      os: null,
      pageUrl,
      projectId: draft.projectId,
      reproductionSteps: steps,
      title,
    },
    ok: true,
  };
};
