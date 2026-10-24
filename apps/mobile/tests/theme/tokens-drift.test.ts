import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildTokenModule } from "../../../../scripts/generate-mobile-tokens";
import * as generated from "@/theme/tokens.generated";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const lightCss = readFileSync(
  path.join(repoRoot, "app", "workspace-styles", "tokens-light.css"),
  "utf8",
);
const darkCss = readFileSync(
  path.join(repoRoot, "app", "workspace-styles", "tokens-dark-accents.css"),
  "utf8",
);
const generatedPath = path.join(repoRoot, "apps", "mobile", "src", "theme", "tokens.generated.ts");

describe("the generated design tokens", () => {
  it("match the workspace CSS exactly", () => {
    expect(readFileSync(generatedPath, "utf8")).toBe(buildTokenModule(lightCss, darkCss));
  });

  it("resolve color-mix against the accent hue", () => {
    expect(generated.theme.light.accentSoft).toBe("rgba(75, 91, 214, 0.1)");
    expect(generated.theme.light.accentLine).toBe("rgba(75, 91, 214, 0.38)");
  });

  it("merge dark over light so every light key exists in dark", () => {
    const lightKeys = Object.keys(generated.theme.light);
    const darkKeys = Object.keys(generated.theme.dark);

    expect(lightKeys.every((key) => darkKeys.includes(key))).toBe(true);
    expect(generated.theme.dark.bg).not.toBe(generated.theme.light.bg);
  });
});
