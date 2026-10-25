import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isActiveHref, mobileTabs, moreGroups } from "@/features/navigation/navigation-data";

// The web file imports React icon components and next types, which cannot
// load in the vitest node environment; the drift test reads it as text and
// compares the structural data both apps share.
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const webSource = readFileSync(
  path.join(repoRoot, "components", "workspace", "workspace-navigation-data.ts"),
  "utf8",
);

interface WebItem {
  readonly adminOnly: boolean;
  readonly href: string;
  readonly label: string;
}

const sectionSources = (): readonly string[] => {
  const sectionsStart = webSource.indexOf("export const sections");
  const sectionsEnd = webSource.indexOf("export const mobileItems");
  const body = webSource.slice(sectionsStart, sectionsEnd);
  return [...body.matchAll(/items: \[([\s\S]*?)\n    \]/gu)].map((match) => match[1] ?? "");
};

const parseItems = (source: string): readonly WebItem[] =>
  [...source.matchAll(/\{([^{}]*)\}/gu)].map((match) => {
    const object = match[1] ?? "";
    return {
      adminOnly: /adminOnly: true/u.test(object),
      href: /href: "([^"]+)"/u.exec(object)?.[1] ?? "",
      label: /label: "([^"]+)"/u.exec(object)?.[1] ?? "",
    };
  });

const webSections = sectionSources().map(parseItems);

describe("the mobile navigation data", () => {
  it("mirrors the web bottom tabs in order", () => {
    const mobileItemsSource = webSource.slice(
      webSource.indexOf("export const mobileItems"),
      webSource.indexOf("export const isNavigationItemActive"),
    );
    const expected = parseItems(mobileItemsSource).map((item) => `${item.href} ${item.label}`);
    const actual = mobileTabs.map((item) => `${item.href} ${item.label}`);

    expect(actual).toEqual(expected);
  });

  it("mirrors the web sidebar entries, including admin-only flags", () => {
    // The More menu excludes the bottom tabs, which the web sidebar lists
    // alongside the rest of the personal section.
    const tabHrefs = new Set(mobileTabs.map((item) => item.href));
    const moreSections = webSections.map((section) =>
      section.filter((item) => !tabHrefs.has(item.href)),
    );

    expect(moreGroups.length).toBe(moreSections.length);

    moreSections.forEach((section, index) => {
      const mobileItems = moreGroups[index]?.items ?? [];
      expect(mobileItems.map((item) => item.label)).toEqual(
        section.map((item) => item.label),
      );
      expect(mobileItems.map((item) => item.href)).toEqual(
        section.map((item) => item.href),
      );
      mobileItems.forEach((item) => {
        expect(item.adminOnly === true, item.label).toBe(
          section.some((web) => web.href === item.href && web.adminOnly),
        );
      });
    });
  });

  it("uses phosphor icon names that exist on both platforms", () => {
    const webIconImports = new Set(
      [...webSource.matchAll(/^  ([A-Za-z]+)(?: as [A-Za-z]+)?,?$/gmu)].map((m) => m[1] ?? ""),
    );
    for (const item of [...mobileTabs, ...moreGroups.flatMap((group) => group.items)]) {
      expect(webIconImports.has(item.icon), `${item.label}: ${item.icon}`).toBe(true);
    }
  });

  it("matches the web active check", () => {
    expect(isActiveHref("/projects", "/")).toBe(false);
    expect(isActiveHref("/", "/")).toBe(true);
    expect(isActiveHref("/projects/abc/tasks", "/projects")).toBe(true);
    expect(isActiveHref("/projects", "/projects")).toBe(true);
  });
});
