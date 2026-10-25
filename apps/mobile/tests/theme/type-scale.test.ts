import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import { FONT_FAMILIES, loadAppFonts } from "@/theme/fonts";
import { capFontScale, FONT_SCALE_CAP, typeStyle } from "@/theme/type-scale";

describe("the type scale", () => {
  it("maps a size and weight to a font style", () => {
    expect(typeStyle("md", { weight: 600 })).toEqual({
      fontFamily: "Geist_600SemiBold",
      fontSize: 14.5,
      lineHeight: 22,
    });
  });

  it("defaults to regular weight and body leading", () => {
    const style = typeStyle("lg", {});

    expect(style.fontFamily).toBe("Geist_400Regular");
    expect(style.fontSize).toBe(16);
    expect(style.lineHeight).toBe(24);
  });

  it("uses the mono family and tight leading when asked", () => {
    const style = typeStyle("sm", { leading: "tight", mono: true });

    expect(style.fontFamily).toBe("GeistMono_400Regular");
    expect(style.fontSize).toBe(12.5);
    expect(style.lineHeight).toBe(16);
  });

  it("exposes the loaded family names per weight", () => {
    expect(FONT_FAMILIES.sans[500]).toBe("Geist_500Medium");
    expect(FONT_FAMILIES.mono[700]).toBe("GeistMono_700Bold");
  });
});

describe("font loading", () => {
  it("degrades to the system font when native modules are unavailable", async () => {
    const exit = await Effect.runPromiseExit(loadAppFonts);

    expect(Exit.isSuccess(exit)).toBe(true);
  });
});

describe('Dynamic Type', () => {
  it('clamps the system font scale to the 200% ceiling', () => {
    expect(capFontScale(1)).toBe(1);
    expect(capFontScale(1.3)).toBeCloseTo(1.3, 5);
    expect(capFontScale(2)).toBeCloseTo(2, 5);
    expect(capFontScale(3.5)).toBe(FONT_SCALE_CAP);
    expect(capFontScale(Number.NaN)).toBe(1);
    expect(capFontScale(0)).toBe(1);
  });
});
