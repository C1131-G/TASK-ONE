// Mentions are stored as @[employeeId] tokens. The server reads them with
// extractMentionIds, so the body keeps the ID and the UI shows the name.
const MENTION_TOKENS = /@\[[0-9a-f-]{36}\]/giu;
const INVALID_QUERY = /[\s@[\]]/u;
const MAX_QUERY_LENGTH = 40;

export interface MentionQuery {
  readonly query: string;
  readonly start: number;
}

export type MentionSegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "mention"; readonly name: string };

export const mentionToken = (employeeId: string): string => `@[${employeeId}]`;

// The text being typed after an @ that ends at the caret, if there is one. The @
// must start a word, and the query may not contain spaces or token brackets.
export const findMentionQuery = (
  value: string,
  caret: number
): MentionQuery | null => {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) {
    return null;
  }
  const query = before.slice(at + 1);
  if (query.length > MAX_QUERY_LENGTH || INVALID_QUERY.test(query)) {
    return null;
  }
  if (at > 0 && !/\s/u.test(before.charAt(at - 1))) {
    return null;
  }
  return { query, start: at };
};

// Replaces the open @query with a token and a trailing space.
export const insertMention = (
  value: string,
  start: number,
  caret: number,
  employeeId: string
): { readonly caret: number; readonly value: string } => {
  const token = `${mentionToken(employeeId)} `;
  return {
    caret: start + token.length,
    value: `${value.slice(0, start)}${token}${value.slice(caret)}`,
  };
};

// Splits a comment into text and names. Unknown IDs read as "employee" rather
// than exposing the raw token.
export const mentionSegments = (
  body: string,
  names: ReadonlyMap<string, string>
): readonly MentionSegment[] => {
  const segments: MentionSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION_TOKENS)) {
    const { index } = match;
    if (index > last) {
      segments.push({ kind: "text", text: body.slice(last, index) });
    }
    const employeeId = match[0].slice(2, -1);
    segments.push({
      kind: "mention",
      name: names.get(employeeId) ?? "employee",
    });
    last = index + match[0].length;
  }
  if (last < body.length) {
    segments.push({ kind: "text", text: body.slice(last) });
  }
  return segments;
};
