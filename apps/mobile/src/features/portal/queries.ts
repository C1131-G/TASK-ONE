import type { Effect } from "effect";

import type { PortalBugSummary } from "@api/routes-bugs";
import type { AppFailure } from "@/errors";
import type { ReportBody } from "@/features/portal/report-form";
import type { MobileApi } from "@/services/mobile-api";
import type { ProjectSummary } from "@/features/workspace/queries";

type Api = MobileApi["Service"];

export type PortalBugRow = typeof PortalBugSummary.Type;

export const listPortalProjects = (
  api: Api,
): Effect.Effect<{ readonly projects: readonly ProjectSummary[] }, AppFailure> =>
  api.call(async (client) => {
    const page = await client.listPortalProjects({ query: {} });
    return {
      projects: page.items.map((project) => ({
        id: project.id,
        key: project.key,
        name: project.name,
        openTasks: 0,
        progress: 0,
      })),
    };
  });

/** The company's reports, newest first as the server orders them. */
export const listPortalBugs = (
  api: Api,
): Effect.Effect<readonly PortalBugRow[], AppFailure> =>
  api.call(async (client) => {
    // The paged list replaces the old capped one; this is its newest page.
    const page = await client.listPortalBugPage({ query: {} });
    return page.items;
  });

export const submitPortalBug = (
  api: Api,
  key: string,
  body: ReportBody,
): Effect.Effect<{ readonly bugId: string; readonly version: number }, AppFailure> =>
  api.call((client) => client.submitPortalBug({ body, idempotencyKey: key }));
