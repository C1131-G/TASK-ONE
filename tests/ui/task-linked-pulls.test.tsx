import { expect, test } from "bun:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TaskLinkedPulls } from "@/features/github/components/task-linked-pulls";
import type { LinkedPull } from "@/src/server/github/github-contracts";

const pull = (overrides: Partial<LinkedPull> = {}): LinkedPull => ({
  authorLogin: "octocat",
  id: "a",
  number: 7,
  repoFullName: "acme/web",
  state: "open",
  title: "Add the thing",
  updatedAt: "2026-10-20T00:00:00.000Z",
  url: "https://github.com/acme/web/pull/7",
  ...overrides,
});

const render = (pulls: readonly LinkedPull[]): string =>
  renderToStaticMarkup(createElement(TaskLinkedPulls, { pulls }));

test("renders nothing when no pull request is linked", () => {
  expect(render([])).toBe("");
});

test("shows the title, state and a safe external link", () => {
  const markup = render([pull()]);
  expect(markup).toContain("Pull requests");
  expect(markup).toContain("Add the thing");
  expect(markup).toContain("Open");
  expect(markup).toContain('href="https://github.com/acme/web/pull/7"');
  expect(markup).toContain('rel="noopener noreferrer"');
  expect(markup).toContain('target="_blank"');
  expect(markup).toContain("acme/web#7");
});

test("labels merged and closed pull requests", () => {
  const markup = render([
    pull({ id: "m", number: 8, state: "merged" }),
    pull({ id: "c", number: 9, state: "closed" }),
  ]);
  expect(markup).toContain("Merged");
  expect(markup).toContain("Closed");
});

test("escapes markup in a pull request title", () => {
  const markup = render([
    pull({ title: '<img src=x onerror="alert(1)"><script>alert(2)</script>' }),
  ]);
  expect(markup).not.toContain("<script>");
  expect(markup).not.toContain("<img");
  expect(markup).toContain("&lt;script&gt;");
  expect(markup).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("never links a URL that is not a GitHub pull request page", () => {
  const scriptScheme = ["java", "script:"].join("");
  const markup = render([
    pull({ url: `${scriptScheme}alert(document.cookie)` }),
    pull({ id: "b", number: 8, url: "https://evil.example/acme/web/pull/8" }),
  ]);
  expect(markup).not.toContain(scriptScheme);
  expect(markup).not.toContain("evil.example");
  expect(markup).not.toContain("<a ");
  expect(markup).toContain("Add the thing");
});
