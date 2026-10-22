// What a browser volunteers with a bug report. The shape and caps mirror the
// server's BrowserContextSchema, which re-validates everything.
export interface BrowserContextSource {
  readonly devicePixelRatio: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly language: string;
  readonly pathname: string;
  readonly timeZone: string;
  readonly userAgent: string;
}

export interface CollectedBrowserContext {
  readonly language: string;
  readonly path: string;
  readonly pixelRatio: number;
  readonly timeZone: string;
  readonly userAgent: string;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}

const MAX_USER_AGENT = 300;
const MAX_LANGUAGE = 35;
const MAX_TIME_ZONE = 64;
const MAX_PATH = 300;
const MAX_PIXEL_RATIO = 10;
// oxlint-disable-next-line no-control-regex -- Control characters are what is removed.
const UNSAFE_CHARACTERS = /[<>\u0000-\u001F\u007F]/gu;

const plain = (value: string, maxLength: number): string =>
  value.replaceAll(UNSAFE_CHARACTERS, "").trim().slice(0, maxLength);

// Only the path: a query string or fragment can carry tokens or personal data.
const barePath = (pathname: string): string =>
  plain(pathname.split(/[?#]/u)[0] ?? "", MAX_PATH);

// Returns undefined when the browser reports too little to be worth sending.
export const collectBrowserContext = (
  source: BrowserContextSource
): CollectedBrowserContext | undefined => {
  const viewportWidth = Math.round(source.innerWidth);
  const viewportHeight = Math.round(source.innerHeight);
  const userAgent = plain(source.userAgent, MAX_USER_AGENT);
  const path = barePath(source.pathname);
  const language = plain(source.language, MAX_LANGUAGE);
  const timeZone = plain(source.timeZone, MAX_TIME_ZONE);
  if (
    viewportWidth < 1 ||
    viewportHeight < 1 ||
    !userAgent ||
    !path.startsWith("/") ||
    !language ||
    !timeZone
  ) {
    return undefined;
  }
  return {
    language,
    path,
    pixelRatio: Math.min(
      MAX_PIXEL_RATIO,
      Math.max(1, Math.round(source.devicePixelRatio * 100) / 100)
    ),
    timeZone,
    userAgent,
    viewportHeight,
    viewportWidth,
  };
};

// The same details in the order and words the reporter sees before sending.
export const describeBrowserContext = (
  context: CollectedBrowserContext
): readonly (readonly [string, string])[] => [
  ["Page", context.path],
  [
    "Window size",
    `${context.viewportWidth} × ${context.viewportHeight} pixels`,
  ],
  ["Screen sharpness", `${context.pixelRatio}× pixel ratio`],
  ["Browser", context.userAgent],
  ["Language", context.language],
  ["Time zone", context.timeZone],
];
