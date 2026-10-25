import { FONT_FAMILIES, type AppWeight } from "@/theme/fonts";
import { type } from "@/theme/tokens.generated";

export const FONT_SIZES = {
  "2xl": type.fs2xl,
  "2xs": type.fs2xs,
  base: type.fs,
  lg: type.fsLg,
  md: type.fsMd,
  sm: type.fsSm,
  xl: type.fsXl,
  xs: type.fsXs,
} as const;

export type FontSizeName = keyof typeof FONT_SIZES;
export type FontLeading = "body" | "tight";

export interface TypeStyle {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
}

export interface TypeStyleOptions {
  readonly leading?: FontLeading;
  readonly mono?: boolean;
  readonly weight?: AppWeight;
}

/** Builds a RN text style from the generated type tokens and the loaded Geist faces. */
export const typeStyle = (
  sizeName: FontSizeName,
  options: TypeStyleOptions = {}
): TypeStyle => {
  const fontSize = FONT_SIZES[sizeName];
  const ratio = options.leading === "tight" ? type.lhTight : type.lhBody;
  const families = options.mono === true ? FONT_FAMILIES.mono : FONT_FAMILIES.sans;
  return {
    fontFamily: families[options.weight ?? 400],
    fontSize,
    lineHeight: Math.ceil(fontSize * ratio),
  };
};
