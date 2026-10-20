import sanitizeHtml from "sanitize-html";

// Rich-text descriptions keep basic formatting and links only; scripts, event
// handlers, styles and non-web URL schemes are stripped before storage.
const DESCRIPTION_HTML_OPTIONS = {
  allowedAttributes: { a: ["href", "title"] },
  allowedSchemes: ["https", "http", "mailto"],
  allowedTags: [
    "a",
    "b",
    "br",
    "code",
    "em",
    "i",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "strong",
    "u",
    "ul",
  ],
} satisfies sanitizeHtml.IOptions;

export const sanitizeDescription = (
  description: string | null
): string | null =>
  description ? sanitizeHtml(description, DESCRIPTION_HTML_OPTIONS) : null;
