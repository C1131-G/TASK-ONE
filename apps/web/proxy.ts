import { NextResponse } from "next/server";

import {
  buildSecurityHeaders,
  storageOriginFromEnv,
} from "@/lib/security-headers";

// Built once per server from runtime env, so a container can point at a
// different S3 endpoint than the one present at build time.
const SECURITY_HEADERS = buildSecurityHeaders({
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  storageOrigin: storageOriginFromEnv(process.env),
});

// eslint-disable-next-line func-style -- Next resolves the `proxy` named export.
export function proxy(): NextResponse {
  const response = NextResponse.next();
  for (const [name, value] of SECURITY_HEADERS) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Hashed build assets and optimized images carry no document to protect.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
