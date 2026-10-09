import { isIP } from "node:net";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The push notification could not be processed.",
      });
export const validateEndpoint = (endpoint: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose a valid HTTPS push endpoint.",
    });
  }
  const hostname = parsed.hostname.toLowerCase();
  const allowedHosts = (
    process.env["WEB_PUSH_ALLOWED_HOSTS"] ??
    "fcm.googleapis.com,push.services.mozilla.com,web.push.apple.com"
  )
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const trustedPushProvider = allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    isIP(hostname) !== 0 ||
    !trustedPushProvider
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose a valid HTTPS push endpoint.",
    });
  }
};

export const requireActiveUser = async (userId: string): Promise<void> => {
  const user = await db.orm.public.User.where({ id: userId })
    .select("deactivatedAt", "mustChangePassword")
    .first();
  if (!user || user.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (user.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
};
