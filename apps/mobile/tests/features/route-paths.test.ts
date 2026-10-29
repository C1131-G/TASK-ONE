import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AREA_HREFS } from "@/features/auth/route-for";

const appRoot = fileURLToPath(new URL("../../src/app", import.meta.url));

const ROUTE_GROUP = /^\(.+\)$/u;

// Expo Router drops `(group)` segments, `index` and `_layout` from the URL, so
// two files in different groups can claim the same path and only one wins.
const urlFor = (file: string): string | null => {
  const segments = file.replace(/\.tsx$/u, "").split(/[\\/]/u);
  if (segments.at(-1) === "_layout") {
    return null;
  }
  const kept = segments.filter((segment) => !ROUTE_GROUP.test(segment) && segment !== "index");
  return `/${kept.join("/")}`;
};

const routeUrls = readdirSync(appRoot, { encoding: "utf8", recursive: true })
  .filter((entry) => entry.endsWith(".tsx"))
  .flatMap((entry) => {
    const url = urlFor(entry);
    return url === null ? [] : [{ file: entry, url }];
  });

describe("app route paths", () => {
  it("gives every screen its own URL", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const { file, url } of routeUrls) {
      const previous = seen.get(url);
      if (previous === undefined) {
        seen.set(url, file);
      } else {
        clashes.push(`${url}: ${previous} and ${file}`);
      }
    }

    expect(clashes).toEqual([]);
  });

  it("serves every area the session can send a user to", () => {
    const urls = new Set(routeUrls.map(({ url }) => url));

    for (const href of Object.values(AREA_HREFS)) {
      expect(urls, href).toContain(path.posix.normalize(href));
    }
  });
});
