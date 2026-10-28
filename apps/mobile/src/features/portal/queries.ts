import type { Effect } from "effect";

import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";
import type { BugSummary, ProjectSummary } from "@/features/workspace/queries";

type Api = MobileApi["Service"];

/** One row of the live portal bug list (an array, not a wrapped object). */
interface PortalBugRow {
  readonly id: string;
  readonly impact: "low" | "medium" | "high" | null;
  readonly projectId: string;
  readonly projectName: string;
  readonly status: string;
  readonly title: string;
}

const bugStatusOf = (status: string): BugSummary["status"] => {
  if (status === "closed") return "fixed";
  if (status === "merged") return "rejected";
  return "open";
};

interface TypedClient {
  readonly createPortalBug: (input: {
    readonly body: { readonly description: string; readonly projectId: string; readonly title: string };
    readonly idempotencyKey: string;
  }) => Promise<{ readonly id: string }>;
  readonly listPortalBugs: () => Promise<readonly PortalBugRow[]>;
  readonly listPortalProjects: () => Promise<{ readonly projects: readonly ProjectSummary[] }>;
}

export const listPortalProjects = (
  api: Api,
): Effect.Effect<{ readonly projects: readonly ProjectSummary[] }, AppFailure> =>
  api.call((client) => (client as unknown as TypedClient).listPortalProjects());

export const listPortalBugs = (
  api: Api,
): Effect.Effect<{ readonly bugs: readonly BugSummary[] }, AppFailure> =>
  api.call(async (client) => {
    const rows = await (client as unknown as TypedClient).listPortalBugs();
    return {
      bugs: rows.map((row) => ({
        id: row.id,
        priority: row.impact ?? "medium",
        projectId: row.projectId,
        projectName: row.projectName,
        status: bugStatusOf(row.status),
        title: row.title,
      })),
    };
  });

export const createPortalBug = (
  api: Api,
  key: string,
  input: { readonly description: string; readonly projectId: string; readonly title: string },
): Effect.Effect<{ readonly id: string }, AppFailure> =>
  api.call((client) =>
    (client as unknown as TypedClient).createPortalBug({ body: input, idempotencyKey: key }),
  );
