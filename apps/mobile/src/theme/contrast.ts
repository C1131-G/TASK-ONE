/** WCAG contrast math over the generated token palette (pure, no React). */

export interface Rgb {
  readonly blue: number;
  readonly green: number;
  readonly red: number;
}

/** Parses #rgb/#rrggbb/#rrggbbaa into channels. */
export const hexToRgb = (hex: string): Rgb | null => {
  const match = /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/iu.exec(hex.trim());
  if (match === null) {
    return null;
  }
  const digits = match[1] ?? "";
  if (digits.length === 3) {
    const [r = "0", g = "0", b = "0"] = digits.split("");
    return {
      blue: Number.parseInt(`${b}${b}`, 16),
      green: Number.parseInt(`${g}${g}`, 16),
      red: Number.parseInt(`${r}${r}`, 16),
    };
  }
  return {
    blue: Number.parseInt(digits.slice(4, 6), 16),
    green: Number.parseInt(digits.slice(2, 4), 16),
    red: Number.parseInt(digits.slice(0, 2), 16),
  };
};

const channelLuminance = (value: number): number => {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance of a color. */
export const luminance = (color: Rgb): number =>
  0.2126 * channelLuminance(color.red) +
  0.7152 * channelLuminance(color.green) +
  0.0722 * channelLuminance(color.blue);

/** WCAG contrast ratio between two colors, from 1 to 21. */
export const contrastRatio = (foreground: string, background: string): number => {
  const front = hexToRgb(foreground);
  const back = hexToRgb(background);
  if (front === null || back === null) {
    return 1;
  }
  const frontL = luminance(front);
  const backL = luminance(back);
  const lighter = Math.max(frontL, backL);
  const darker = Math.min(frontL, backL);
  return (lighter + 0.05) / (darker + 0.05);
};

/** AA for normal text (4.5) and for large text or UI components (3.0). */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3.0;

export const meetsAA = (
  foreground: string,
  background: string,
  threshold: number = AA_NORMAL,
): boolean => contrastRatio(foreground, background) >= threshold - 1e-9;
