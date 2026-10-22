import type { CollectedBrowserContext } from "@/features/portal/portal-browser-context";

interface ExtrasPayload {
  readonly description: string | null;
}

// What the report form adds beyond its fields: the screenshot's text
// alternative joins the description, and the technical details ride along
// only when the reporter left the box ticked.
export const withReportExtras = <Payload extends ExtrasPayload>(
  payload: Payload,
  extras: {
    readonly context: CollectedBrowserContext | undefined;
    readonly screenshotDescription: string | undefined;
    readonly sendContext: boolean;
  }
) => {
  const note = extras.screenshotDescription
    ? `Screenshot: ${extras.screenshotDescription}`
    : undefined;
  return {
    ...payload,
    description:
      [payload.description, note].filter(Boolean).join("\n\n") || null,
    ...(extras.sendContext && extras.context
      ? { browserContext: extras.context }
      : {}),
  };
};
