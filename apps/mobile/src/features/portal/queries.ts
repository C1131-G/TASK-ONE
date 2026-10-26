import type { Effect } from "effect";

import type { PortalBugSummary } from "@api/routes-bugs";
import type { AppFailure } from "@/errors";
import type { ReportBody } from "@/features/portal/report-form";
import type { MobileApi } from "@/services/mobile-api";
import type { ProjectSummary } from "@/features/workspace/queries";

type Api = MobileApi["Service"];

export type PortalBugRow = typeof PortalBugSummary.Type;

// The portal's project list is still pending on the server, so it goes through
// this narrow client until the route lands.
interface PendingClient {
  readonly listPortalProjects: () => Promise<{ readonly projects: readonly ProjectSummary[] }>;
}

export const listPortalProjects = (
  api: Api,
): Effect.Effect<{ readonly projects: readonly ProjectSummary[] }, AppFailure> =>
  api.call((client) => (client as unknown as PendingClient).listPortalProjects());

/** The company's reports, newest first as the server orders them. */
export const listPortalBugs = (
  api: Api,
): Effect.Effect<readonly PortalBugRow[], AppFailure> =>
  api.call((client) => client.listPortalBugs({ query: {} }));

export const submitPortalBug = (
  api: Api,
  key: string,
  body: ReportBody,
): Effect.Effect<{ readonly bugId: string; readonly version: number }, AppFailure> =>
  api.call((client) => client.submitPortalBug({ body, idempotencyKey: key }));
