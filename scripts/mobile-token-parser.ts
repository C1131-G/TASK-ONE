/**
 * Pure helpers that read the workspace CSS token files. Shared by
 * scripts/generate-mobile-tokens.ts and the mobile drift test, so both always
 * agree on how the CSS is interpreted.
 */

export interface CssBlock {
  readonly selector: string;
  readonly declarations: ReadonlyMap<string, string>;
}

const BLOCK_PATTERN = /(?<selector>[^{}]+)\{(?<body>[^{}]*)\}/gu;
const WHITESPACE_PATTERN = /\s+/gu;

/** Splits a stylesheet into selector → declaration blocks, values whitespace-collapsed. */
export const parseCssBlocks = (css: string): readonly CssBlock[] => {
  const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//gu, "");
  const blocks: CssBlock[] = [];
  for (const match of withoutComments.matchAll(BLOCK_PATTERN)) {
    const rawSelector = match.groups?.selector ?? "";
    const rawBody = match.groups?.body ?? "";
    const declarations = new Map<string, string>();
    for (const rule of rawBody.split(";")) {
      const separator = rule.indexOf(":");
      if (separator === -1) {
        continue;
      }
      const name = rule.slice(0, separator).trim();
      if (!name.startsWith("--")) {
        continue;
      }
      const value = rule
        .slice(separator + 1)
        .replace(WHITESPACE_PATTERN, " ")
        .trim();
      declarations.set(name, value);
    }
    blocks.push({ declarations, selector: rawSelector.trim() });
  }
  return blocks;
};

/** Replaces var(--x) references with values from the block, falling back to a parent block. */
export const resolveVars = (
  value: string,
  declarations: ReadonlyMap<string, string>,
  parent: ReadonlyMap<string, string> = new Map(),
  depth = 0
): string => {
  if (depth > 8 || !value.includes("var(")) {
    return value;
  }
  const resolved = value.replaceAll(
    /var\((?<name>--[\w-]+)\)/gu,
    (_match, name: string) => {
      const own = declarations.get(name);
      const inherited = own ?? parent.get(name);
      return inherited ?? name;
    }
  );
  return resolveVars(resolved, declarations, parent, depth + 1);
};

interface Rgba {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

const TRANSPARENT: Rgba = { alpha: 0, blue: 0, green: 0, red: 0 };

const expandHexPair = (pair: string): number => Number.parseInt(pair, 16);

const parseColor = (value: string): Rgba | null => {
  if (value.trim().toLowerCase() === "transparent") {
    return TRANSPARENT;
  }
  const hex = /^#(?<digits>[\da-f]{3,8})$/iu.exec(value.trim());
  if (hex !== null) {
    const digits = hex.groups?.digits ?? "";

    if (digits.length === 3 || digits.length === 4) {
      const [r, g, b, a = ""] = digits.split("");
      return {
        alpha: a === undefined ? 1 : expandHexPair(`${a}${a}`) / 255,
        blue: expandHexPair(`${b}${b}`),
        green: expandHexPair(`${g}${g}`),
        red: expandHexPair(`${r}${r}`),
      };
    }
    if (digits.length === 6 || digits.length === 8) {
      return {
        alpha:
          digits.length === 8 ? expandHexPair(digits.slice(6, 8)) / 255 : 1,
        blue: expandHexPair(digits.slice(4, 6)),
        green: expandHexPair(digits.slice(2, 4)),
        red: expandHexPair(digits.slice(0, 2)),
      };
    }
    return null;
  }
  const rgb = /^rgba?\((?<channels>[^)]+)\)$/iu.exec(value.trim());
  if (rgb !== null) {
    const parts = (rgb.groups?.channels ?? "")
      .split(/[\s,/]+/u)
      .filter((part) => part.length > 0);
    const red = parts[0] ?? "0";
    const green = parts[1] ?? "0";
    const blue = parts[2] ?? "0";
    const alpha = parts[3] ?? "1";
    return {
      alpha: alpha.endsWith("%") ? Number(alpha) / 100 : Number(alpha),
      blue: Number(blue),
      green: Number(green),
      red: Number(red),
    };
  }
  return null;
};

const shadowChannel = (value: number): string => String(Math.round(value));

const serializeRgba = ({ red, green, blue, alpha }: Rgba): string =>
  alpha === 1
    ? `rgb(${shadowChannel(red)}, ${shadowChannel(green)}, ${shadowChannel(blue)})`
    : `rgba(${shadowChannel(red)}, ${shadowChannel(green)}, ${shadowChannel(blue)}, ${Number(alpha.toFixed(3))})`;

/**
 * Resolves color-mix(in srgb, A p%, B) to an rgba() string using CSS
 * premultiplied interpolation. Anything that is not a color-mix passes
 * through unchanged.
 */
export const resolveColor = (value: string): string => {
  const mix =
    /^color-mix\(\s*in srgb,\s*(?<first>.+?),\s*(?<second>.+?)\s*\)$/u.exec(
      value.trim()
    );
  if (mix === null) {
    return value.trim();
  }
  const firstRaw = mix.groups?.first?.trim() ?? "";
  const secondRaw = mix.groups?.second?.trim() ?? "";
  const percentPattern = /^(?<color>.*?)(?:\s+(?<percent>[\d.]+)%)?$/u.exec(
    firstRaw
  );
  const colorPart = percentPattern?.groups?.color?.trim() ?? firstRaw;
  const percentText = percentPattern?.groups?.percent;
  const percent = percentText === undefined ? 50 : Number(percentText);
  const first = parseColor(colorPart);
  const second = parseColor(secondRaw);
  if (first === null || second === null) {
    return value.trim();
  }
  const share = percent / 100;
  const alpha = first.alpha * share + second.alpha * (1 - share);
  // CSS premultiplies channels for interpolation and un-premultiplies the
  // result, so mixing any color with transparent keeps its hue.
  const mixed =
    alpha === 0
      ? { alpha, blue: 0, green: 0, red: 0 }
      : {
          alpha,
          blue:
            (first.blue * share * first.alpha +
              second.blue * (1 - share) * second.alpha) /
            alpha,
          green:
            (first.green * share * first.alpha +
              second.green * (1 - share) * second.alpha) /
            alpha,
          red:
            (first.red * share * first.alpha +
              second.red * (1 - share) * second.alpha) /
            alpha,
        };
  return serializeRgba(mixed);
};

/** Converts a CSS value to the number RN styles want, else keeps the string. */
export const convertValue = (value: string): string | number => {
  const px = /^(?<amount>[\d.]+)px$/u.exec(value);
  if (px !== null) {
    return Number(px.groups?.amount ?? "0");
  }
  const ms = /^(?<amount>[\d.]+)ms$/u.exec(value);
  if (ms !== null) {
    return Number(ms.groups?.amount ?? "0");
  }
  const percent = /^(?<amount>[\d.]+)%$/u.exec(value);
  if (percent !== null) {
    return Number(percent.groups?.amount ?? "0");
  }
  const unitless = /^-?[\d.]+$/u.exec(value);
  if (unitless !== null) {
    return Number(value);
  }
  return value;
};

/** Turns a --custom-name into a camelCase key, dropping any listed prefix. */
export const tokenKey = (name: string, prefix = ""): string => {
  const withoutPrefix =
    prefix.length > 0 && name.startsWith(prefix)
      ? name.slice(prefix.length)
      : name;
  return withoutPrefix
    .replace(/^--/u, "")
    .replaceAll(/-(?<letter>[a-z0-9])/gu, (_match, letter: string) =>
      letter.toUpperCase()
    );
};

/** Pulls the first quoted font family out of a CSS font stack. */
export const firstFontFamily = (stack: string): string =>
  /"(?<family>[^"]+)"/u.exec(stack)?.groups?.family ??
  stack.split(",")[0]?.trim() ??
  stack;
