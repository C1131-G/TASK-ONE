const GENERIC_DEVICE = "Browser session";
const MAX_LABEL_LENGTH = 60;

// Order matters in both lists: a browser or system listed first can also match
// a later pattern (Edge and Chrome both say "Chrome", Android says "Linux",
// iPhones say "Mac OS X").
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg(?:e|A|iOS)?\//u, "Edge"],
  [/OPR\/|Opera/u, "Opera"],
  [/Firefox\/|FxiOS\//u, "Firefox"],
  [/Chrome\/|Chromium\/|CriOS\//u, "Chrome"],
  [/Safari\//u, "Safari"],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Windows/u, "Windows"],
  [/Android/u, "Android"],
  [/iPhone|iPad|iPod/u, "iOS"],
  [/Mac OS X|Macintosh/u, "macOS"],
  [/CrOS/u, "ChromeOS"],
  [/Linux|X11/u, "Linux"],
];

const firstMatch = (
  userAgent: string,
  table: readonly (readonly [RegExp, string])[]
): string | null => {
  for (const [pattern, name] of table) {
    if (pattern.test(userAgent)) {
      return name;
    }
  }
  return null;
};

/**
 * A short, readable name for a signed-in browser, such as "Chrome on Windows".
 * Raw user agent strings are long and unbroken, which stretches narrow layouts.
 */
export const describeDevice = (userAgent: string | null): string => {
  const raw = userAgent?.trim() ?? "";
  if (!raw) {
    return GENERIC_DEVICE;
  }
  const browser = firstMatch(raw, BROWSERS);
  const system = firstMatch(raw, SYSTEMS);
  if (browser && system) {
    return `${browser} on ${system}`;
  }
  if (browser) {
    return browser;
  }
  if (system) {
    return `${GENERIC_DEVICE} on ${system}`;
  }
  return raw.length > MAX_LABEL_LENGTH
    ? `${raw.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`
    : raw;
};
