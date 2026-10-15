import { PORTAL_PREVIEW_COOKIE } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import {
  endPortalPreview,
  startPortalPreview,
} from "@/src/server/portal/portal-preview";

const PREVIEW_MAX_AGE_SECONDS = 60 * 60;

const cookieHeader = (value: string, maxAge: number, secure: boolean): string =>
  `${PORTAL_PREVIEW_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;

const readPreviewCookie = (headers: Headers): string | null => {
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === PORTAL_PREVIEW_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
};

const redirectTo = (
  request: Request,
  path: string,
  cookie?: string
): Response => {
  const headers = new Headers({
    "cache-control": "no-store",
    location: new URL(path, request.url).toString(),
  });
  if (cookie) {
    headers.append("set-cookie", cookie);
  }
  return new Response(null, { headers, status: 303 });
};

// GET /portal/preview?as=<clientUserId> starts a read-only preview;
// GET /portal/preview?exit=1 ends it.
// eslint-disable-next-line func-style -- Next route handler remains a named export.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  try {
    if (url.searchParams.get("exit")) {
      const previewing = readPreviewCookie(request.headers);
      if (previewing) {
        await endPortalPreview(request.headers, previewing);
      }
      return redirectTo(request, "/clients", cookieHeader("", 0, secure));
    }
    const target = url.searchParams.get("as")?.trim() ?? "";
    if (!target || target.length > 200) {
      return redirectTo(request, "/clients");
    }
    await startPortalPreview(request.headers, target);
    return redirectTo(
      request,
      "/portal",
      cookieHeader(target, PREVIEW_MAX_AGE_SECONDS, secure)
    );
  } catch (error) {
    // Anyone who is not a signed-in admin simply lands back on their own home.
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
      return redirectTo(request, "/login");
    }
    return redirectTo(request, "/");
  }
}
