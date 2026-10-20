import type { Instrumentation } from "next";

const isNodeRuntime = () => process.env["NEXT_RUNTIME"] === "nodejs";

export const register = async (): Promise<void> => {
  if (!isNodeRuntime()) {
    return;
  }
  const { parseServerEnv } = await import("./src/server/core/env");
  // Throws before the server accepts requests when configuration is invalid.
  parseServerEnv();

  // OPTIONAL HOOK: register Sentry or OpenTelemetry here (for example
  // `registerOTel(...)` from @vercel/otel). No vendor SDK is installed.
};

const readDigest = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : undefined;

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  if (!isNodeRuntime()) {
    return;
  }
  const { logger } = await import("./src/server/core/logger");
  const digest = readDigest(error);
  logger.error("Unhandled error while serving a request.", {
    error,
    method: request.method,
    // Query strings can carry reset or invitation tokens.
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    ...(digest === undefined ? {} : { digest }),
  });

  // OPTIONAL HOOK: forward `error` to Sentry/OpenTelemetry here. Request
  // headers are deliberately not logged because they carry session cookies.
};
