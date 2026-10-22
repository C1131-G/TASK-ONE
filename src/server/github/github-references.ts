// Finds task keys (`MET-12`) in the text a pull request carries. Only the key
// of the connection's own project counts, so a pull request that names a task
// in another project links nothing.

export const MAX_REFERENCES_PER_PULL = 10;
const MAX_TEXT_LENGTH = 20_000;
const MAX_TASK_NUMBER = 999_999_999;
const MAX_TITLE_LENGTH = 300;
const UNTITLED = "Untitled pull request";

const REGEX_SYNTAX = /[.*+?^${}()|[\]\\]/gu;
// Control characters and bidirectional overrides can disguise a title.
const UNSAFE_TEXT = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const WHITESPACE_RUN = /\s+/gu;

const referencePattern = (projectKey: string): RegExp =>
  new RegExp(
    `(?<![A-Za-z0-9])${projectKey.replaceAll(REGEX_SYNTAX, String.raw`\$&`)}-(\\d{1,10})(?![A-Za-z0-9])`,
    "giu"
  );

export const extractTaskNumbers = (
  projectKey: string,
  texts: readonly (string | null | undefined)[]
): number[] => {
  const pattern = referencePattern(projectKey);
  const found = new Set<number>();
  for (const text of texts) {
    if (!text) {
      continue;
    }
    for (const match of text.slice(0, MAX_TEXT_LENGTH).matchAll(pattern)) {
      const number = Number(match[1]);
      if (number > 0 && number <= MAX_TASK_NUMBER) {
        found.add(number);
      }
      if (found.size >= MAX_REFERENCES_PER_PULL) {
        return [...found];
      }
    }
  }
  return [...found];
};

/** A one-line plain-text title. Markup stays as text; the UI escapes it. */
export const sanitizePullTitle = (title: string): string => {
  const cleaned = title
    .replaceAll(UNSAFE_TEXT, (character) =>
      character === "\n" || character === "\t" ? " " : ""
    )
    .replaceAll(WHITESPACE_RUN, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
    .trim();
  return cleaned || UNTITLED;
};
