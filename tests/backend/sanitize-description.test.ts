/* eslint-disable no-script-url -- The hostile URLs are the test inputs. */
import { expect, it } from "bun:test";

import { sanitizeDescription } from "../../src/server/work/sanitize-description";

const clean = (html: string): string => sanitizeDescription(html) ?? "";
const EVENT_ATTRIBUTE = /\son\w+\s*=/iu;
const DANGEROUS_ELEMENT =
  /<\s*(?:script|iframe|object|embed|form|input|img|svg|style)/iu;
const DANGEROUS_SCHEME = /javascript|vbscript|data:/iu;

it("returns null for empty input", () => {
  expect(sanitizeDescription(null)).toBeNull();
  expect(sanitizeDescription("")).toBeNull();
});

it("keeps basic formatting and safe links untouched", () => {
  const html =
    '<p>Hi <strong>there</strong> <em>you</em></p><ul><li>one</li></ul><a href="https://example.com/a?b=1" title="t">link</a><a href="mailto:a@b.test">mail</a>';

  expect(clean(html)).toBe(html);
});

it("drops script and style elements together with their contents", () => {
  const result = clean(
    '<p>ok</p><script>alert(1)</script><SCRIPT SRC="//evil.test/x.js"></SCRIPT><style>body{display:none}</style>'
  );

  expect(result).toBe("<p>ok</p>");
});

it("removes event handlers from allowed and disallowed tags", () => {
  const result = clean(
    '<p onclick="x()">a</p><b onmouseover = "x()">b</b><img src=x onerror=alert(1)><svg onload="x()"></svg>'
  );

  expect(result).not.toMatch(EVENT_ATTRIBUTE);
  expect(result).not.toMatch(DANGEROUS_ELEMENT);
  expect(result).toContain("<p>a</p>");
  expect(result).toContain("<b>b</b>");
});

it("rejects javascript, data and vbscript URLs including obfuscated forms", () => {
  const hrefs = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "&#106;avascript:alert(1)",
    "&#x6A;avascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
  ];

  for (const href of hrefs) {
    const result = clean(`<a href="${href}">x</a>`);
    expect(result).not.toMatch(DANGEROUS_SCHEME);
    expect(result).not.toContain("href");
  }
});

it("does not let a link target, inline style or class survive", () => {
  const result = clean(
    '<a href="https://example.com" target="_blank" style="x:expression(alert(1))" class="c">x</a>'
  );

  expect(result).toBe('<a href="https://example.com">x</a>');
});

it("neutralises nested and malformed markup", () => {
  const payloads = [
    "<scr<script>ipt>alert(1)</scr</script>ipt>",
    "<<script>script>alert(1)<</script>/script>",
    '<a href="https://ok.test"><script>alert(1)</script>t</a>',
    '<p><b><i onclick="x()">deep</i></b>',
    '<img src="x" onerror="alert(1)"//>',
    '<a href="javascript:alert(1)"<b>x</b>',
    "<iframe src=//evil.test></iframe><object data=x></object><embed src=x>",
    '<form action="//evil.test"><input name=a></form>',
  ];

  for (const payload of payloads) {
    const result = clean(payload);
    expect(result).not.toMatch(DANGEROUS_ELEMENT);
    expect(result).not.toMatch(EVENT_ATTRIBUTE);
    expect(result).not.toMatch(/href\s*=\s*["']?\s*javascript/iu);
  }
});

it("is stable when sanitised output is sanitised again", () => {
  const once = clean(
    '<p onclick="x()">a</p><script>alert(1)</script><a href="javascript:x()">b</a><a href="https://example.com">c</a>'
  );

  expect(clean(once)).toBe(once);
});

it("keeps escaped angle brackets as text instead of reviving them as markup", () => {
  const result = clean("<p>1 &lt; 2 &lt;script&gt;alert(1)&lt;/script&gt;</p>");

  expect(result).not.toContain("<script");
});
