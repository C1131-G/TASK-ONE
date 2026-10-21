import { expect, test } from "bun:test";

import { Tray } from "@phosphor-icons/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EmptyState } from "@/components/workspace/empty-state";

const render = (props: Record<string, unknown> = {}): string =>
  renderToStaticMarkup(
    createElement(EmptyState, { icon: Tray, title: "No bugs yet", ...props })
  );

test("empty state names what is missing with a heading and a hidden icon", () => {
  const markup = render({ description: "Reported bugs show up here." });

  expect(markup).toContain('<h3 class="es-h">No bugs yet</h3>');
  expect(markup).toContain("<p>Reported bugs show up here.</p>");
  expect(markup).toContain('<span aria-hidden="true" class="glyph">');
  expect(markup).toContain('class="empty-state"');
});

test("empty state omits the description paragraph and action when absent", () => {
  const markup = render();

  expect(markup).not.toContain("<p>");
  expect(markup).not.toContain("<button");
});

test("empty state renders the action it is given", () => {
  const markup = render({
    action: createElement("button", { type: "button" }, "Report a bug"),
  });

  expect(markup).toContain('<button type="button">Report a bug</button>');
});

test("empty state follows the requested size and heading level", () => {
  expect(render({ size: "panel" })).toContain('class="panel empty-state"');
  expect(render({ size: "compact" })).toContain('class="empty-state sm"');
  expect(render({ headingLevel: 2 })).toContain(
    '<h2 class="es-h">No bugs yet</h2>'
  );
});
