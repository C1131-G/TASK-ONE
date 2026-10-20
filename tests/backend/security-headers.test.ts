import { expect, it } from "bun:test";

import {
  buildSecurityHeaders,
  storageOriginFromEnv,
} from "../../lib/security-headers";

const headerMap = (
  options: Parameters<typeof buildSecurityHeaders>[0]
): Map<string, string> => new Map(buildSecurityHeaders(options));

it("locks production pages to this origin and the storage endpoint", () => {
  const headers = headerMap({
    isDevelopment: false,
    isProduction: true,
    storageOrigin: "https://files.example.com",
  });
  const csp = headers.get("Content-Security-Policy") ?? "";

  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("connect-src 'self' https://files.example.com");
  expect(csp).toContain("img-src 'self' blob: data: https://files.example.com");
  expect(csp).toContain("media-src 'self' blob: https://files.example.com");
  expect(csp).toContain("worker-src 'self'");
  expect(csp).toContain("upgrade-insecure-requests");
  expect(csp).not.toContain("unsafe-eval");
  expect(headers.get("Strict-Transport-Security")).toContain("max-age=");
  expect(headers.get("X-Frame-Options")).toBe("DENY");
  expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(headers.get("Referrer-Policy")).toBe(
    "strict-origin-when-cross-origin"
  );
  expect(headers.get("Permissions-Policy")).toContain("camera=()");
  expect(headers.get("Permissions-Policy")).toContain("microphone=()");
  expect(headers.get("Permissions-Policy")).toContain("geolocation=()");
});

it("allows eval only in development and skips HSTS outside production", () => {
  const headers = headerMap({
    isDevelopment: true,
    isProduction: false,
    storageOrigin: "http://localhost:9000",
  });

  expect(headers.get("Content-Security-Policy")).toContain("'unsafe-eval'");
  expect(headers.has("Strict-Transport-Security")).toBe(false);
});

it("does not upgrade requests to a plain-http storage endpoint", () => {
  const csp =
    headerMap({
      isDevelopment: false,
      isProduction: true,
      storageOrigin: "http://localhost:9000",
    }).get("Content-Security-Policy") ?? "";

  expect(csp).toContain("http://localhost:9000");
  expect(csp).not.toContain("upgrade-insecure-requests");
});

it("derives the storage origin the presigned URLs use", () => {
  expect(
    storageOriginFromEnv({
      S3_ENDPOINT: "http://minio:9000",
      S3_PUBLIC_ENDPOINT: "https://files.example.com/base",
    })
  ).toBe("https://files.example.com");
  expect(storageOriginFromEnv({ S3_ENDPOINT: "http://minio:9000" })).toBe(
    "http://minio:9000"
  );
  expect(
    storageOriginFromEnv({ S3_BUCKET: "docs", S3_REGION: "eu-west-1" })
  ).toBe("https://docs.s3.eu-west-1.amazonaws.com");
});
