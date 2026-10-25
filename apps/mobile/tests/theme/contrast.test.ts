import { describe, expect, it } from "vitest";

import {
  AA_LARGE,
  AA_NORMAL,
  contrastRatio,
  hexToRgb,
  meetsAA,
} from "@/theme/contrast";
import { theme } from "@/theme/tokens.generated";

describe("the WCAG contrast math", () => {
  it("parses hex colors of each width", () => {
    expect(hexToRgb("#ffffff")).toEqual({ blue: 255, green: 255, red: 255 });
    expect(hexToRgb("#000")).toEqual({ blue: 0, green: 0, red: 0 });
    expect(hexToRgb("not-a-color")).toBeNull();
  });

  it("reproduces the canonical black-on-white ratio of 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("treats unparseable colors as unusable", () => {
    expect(contrastRatio("oops", "#ffffff")).toBe(1);
    expect(meetsAA("oops", "#ffffff")).toBe(false);
  });
});

describe("the generated palette's accessibility pass", () => {
  const cases: readonly [string, string, string, number][] = [
    ["light body text on page background", theme.light.text, theme.light.bg, AA_NORMAL],
    ["light body text on cards", theme.light.text, theme.light.surface, AA_NORMAL],
    ["light secondary text on cards", theme.light.text2, theme.light.surface, AA_NORMAL],
    ["light muted text on cards", theme.light.text3, theme.light.surface, AA_NORMAL],
    ["light text on sunken wells", theme.light.text, theme.light.sunken, AA_NORMAL],
    ["light action label on the accent", theme.light.onAccent, theme.light.accent, AA_NORMAL],
    ["light danger text on cards", theme.light.red, theme.light.surface, AA_NORMAL],
    ["dark body text on page background", theme.dark.text, theme.dark.bg, AA_NORMAL],
    ["dark body text on cards", theme.dark.text, theme.dark.surface, AA_NORMAL],
    ["dark secondary text on cards", theme.dark.text2, theme.dark.surface, AA_NORMAL],
    ["dark muted text on cards", theme.dark.text3, theme.dark.surface, AA_NORMAL],
    ["dark action label on the accent", theme.dark.onAccent, theme.dark.accent, AA_NORMAL],
    ["dark danger text on cards", theme.dark.red, theme.dark.surface, AA_NORMAL],
    ["light status chip on its own card (large/UI)", theme.light.stDone, theme.light.surface, AA_LARGE],
    ["dark status chip on its own card (large/UI)", theme.dark.stDone, theme.dark.surface, AA_LARGE],
  ];

  it.each(cases)("%s meets its threshold", (label, foreground, background, threshold) => {
    expect(meetsAA(foreground, background, threshold), `${label}: ${contrastRatio(foreground, background).toFixed(2)}`).toBe(true);
  });

  it("audits every accent variant's on-accent pairing in the theme that uses it", () => {
    const accents = [
      { accD: theme.dark.accent, onD: theme.dark.onAccent },
      { accD: theme.light.accent, onD: theme.light.onAccent },
    ];
    for (const pair of accents) {
      expect(contrastRatio(pair.onD, pair.accD)).toBeGreaterThanOrEqual(AA_NORMAL - 1e-9);
    }
  });
});
