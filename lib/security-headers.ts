// Response headers applied to every page and API response by `proxy.ts`.
//
// The CSP is static rather than nonce-based: Cache Components prerender a
// static shell that cannot carry a per-request nonce, so Next's inline
// bootstrap scripts and the next-themes pre-paint script need
// 'unsafe-inline'. Everything else is locked to this origin plus the private
// S3 endpoint that presigned uploads, previews and downloads talk to.

type HeaderEntry = readonly [name: string, value: string];

interface SecurityHeaderOptions {
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
  /** Origin of the browser-facing S3 endpoint, when files are enabled. */
  readonly storageOrigin: string | undefined;
}

const TWO_YEARS_IN_SECONDS = 63_072_000;

const toOrigin = (url: string | undefined): string | undefined => {
  if (!url) {
    return undefined;
  }
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

// Mirrors src/server/storage/storage.ts: presigned URLs use the public
// endpoint (path style), else AWS's virtual-hosted bucket address.
export const storageOriginFromEnv = (
  env: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const endpoint = env["S3_PUBLIC_ENDPOINT"] ?? env["S3_ENDPOINT"];
  if (endpoint) {
    return toOrigin(endpoint);
  }
  const bucket = env["S3_BUCKET"] ?? "metsys-private";
  const region = env["S3_REGION"] ?? "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com`;
};

const buildContentSecurityPolicy = ({
  isDevelopment,
  isProduction,
  storageOrigin,
}: SecurityHeaderOptions): string => {
  const storage = storageOrigin ? [storageOrigin] : [];
  // A plain-http storage endpoint (local MinIO) would be rewritten to https
  // and fail, so only upgrade when every allowed origin is already secure.
  const upgradeInsecure =
    isProduction && !storage.some((origin) => origin.startsWith("http:"));
  const directives: readonly (readonly string[])[] = [
    ["default-src", "'self'"],
    [
      "script-src",
      "'self'",
      "'unsafe-inline'",
      // React rebuilds server error stacks with eval in development only.
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "blob:", "data:", ...storage],
    ["media-src", "'self'", "blob:", ...storage],
    ["connect-src", "'self'", ...storage],
    ["font-src", "'self'", "data:"],
    ["worker-src", "'self'"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ...(upgradeInsecure ? [["upgrade-insecure-requests"]] : []),
  ];
  return directives.map((directive) => directive.join(" ")).join("; ");
};

export const buildSecurityHeaders = (
  options: SecurityHeaderOptions
): readonly HeaderEntry[] => [
  ["Content-Security-Policy", buildContentSecurityPolicy(options)],
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  ],
  ...(options.isProduction
    ? [
        [
          "Strict-Transport-Security",
          `max-age=${TWO_YEARS_IN_SECONDS}; includeSubDomains`,
        ] satisfies HeaderEntry,
      ]
    : []),
];
