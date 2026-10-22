import { collectBrowserContext } from "@/features/portal/portal-browser-context";
import type { CollectedBrowserContext } from "@/features/portal/portal-browser-context";

const NO_CONTEXT = "";

// A string snapshot, so React can read the live browser facts without an
// effect, and what is shown is exactly what is sent.
export const contextSnapshot = (): string => {
  const collected = collectBrowserContext({
    devicePixelRatio: window.devicePixelRatio,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    language: navigator.language,
    pathname: window.location.pathname,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent: navigator.userAgent,
  });
  return collected ? JSON.stringify(collected) : NO_CONTEXT;
};

export const contextServerSnapshot = (): string => NO_CONTEXT;

export const subscribeToContext = (notify: () => void): (() => void) => {
  window.addEventListener("resize", notify);
  return () => window.removeEventListener("resize", notify);
};

export const parseContext = (
  snapshot: string
): CollectedBrowserContext | undefined =>
  snapshot ? JSON.parse(snapshot) : undefined;
