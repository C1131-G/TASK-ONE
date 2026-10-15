export interface DetectedEnvironment {
  readonly browser: string;
  readonly device: string;
  readonly os: string;
}

interface UserAgentDataLike {
  readonly mobile?: boolean;
  readonly platform?: string;
}

// Each pattern matches "Name/1.2.3"; the version is whatever follows the slash.
const BROWSER_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ["Edge", /Edg(?:e|A|iOS)?\/[\d.]+/u],
  ["Opera", /OPR\/[\d.]+/u],
  ["Firefox", /(?:Firefox|FxiOS)\/[\d.]+/u],
  ["Chrome", /(?:Chrome|CriOS)\/[\d.]+/u],
  ["Safari", /Version\/[\d.]+(?=.*Safari)/u],
];

const ANDROID = /Android [\d.]+/u;
const IOS = /OS \d+/u;

const detectBrowser = (userAgent: string): string => {
  for (const [name, pattern] of BROWSER_PATTERNS) {
    const found = pattern.exec(userAgent)?.[0];
    if (found !== undefined) {
      const major = found.split("/")[1]?.split(".")[0] ?? "";
      return `${name} ${major}`.trim();
    }
  }
  return "";
};

const detectOs = (userAgent: string, platform: string | undefined): string => {
  const android = ANDROID.exec(userAgent)?.[0];
  if (android !== undefined) {
    return android;
  }
  if (/iPhone|iPad|iPod/u.test(userAgent)) {
    const version = IOS.exec(userAgent)?.[0]?.slice("OS ".length);
    return version ? `iOS ${version}` : "iOS";
  }
  if (/Windows/u.test(userAgent)) {
    return "Windows";
  }
  if (/CrOS/u.test(userAgent)) {
    return "ChromeOS";
  }
  if (/Mac OS X|Macintosh/u.test(userAgent)) {
    return "macOS";
  }
  if (/Linux/u.test(userAgent)) {
    return "Linux";
  }
  return platform ?? "";
};

const deviceKind = (userAgent: string, mobile: boolean): string => {
  if (/iPad|Tablet/u.test(userAgent)) {
    return "Tablet";
  }
  return mobile ? "Phone" : "Desktop";
};

// Best effort from what the browser volunteers. People can edit the result.
export const detectEnvironment = (): DetectedEnvironment => {
  const { userAgent } = navigator;
  const data = (navigator as { userAgentData?: UserAgentDataLike })
    .userAgentData;
  const mobile = data?.mobile ?? /Mobi|Android|iPhone|iPod/u.test(userAgent);
  return {
    browser: detectBrowser(userAgent),
    device: `${deviceKind(userAgent, mobile)}, ${window.screen.width}×${window.screen.height} screen`,
    os: detectOs(userAgent, data?.platform),
  };
};

const NO_ENVIRONMENT = "";
let cached: string | undefined;

// A stable string snapshot, so React can read the browser's environment
// without an effect.
export const environmentSnapshot = (): string => {
  cached ??= JSON.stringify(detectEnvironment());
  return cached;
};

export const environmentServerSnapshot = (): string => NO_ENVIRONMENT;

export const parseEnvironment = (snapshot: string): DetectedEnvironment => {
  if (!snapshot) {
    return { browser: "", device: "", os: "" };
  }
  return JSON.parse(snapshot) as DetectedEnvironment;
};
