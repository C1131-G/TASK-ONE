import type { Effect } from "effect";

import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";
import type { BugSummary, ProjectSummary } from "@/features/workspace/queries";

type Api = MobileApi["Service"];

interface TypedClient {
  readonly createPortalBug: (input: {
    readonly body: { readonly description: string; readonly projectId: string; readonly title: string };
    readonly idempotencyKey: string;
  }) => Promise<{ readonly id: string }>;
  readonly listPortalBugs: () => Promise<{ readonly bugs: readonly BugSummary[] }>;
  readonly listPortalProjects: () => Promise<{ readonly projects: readonly ProjectSummary[] }>;
}

export const listPortalProjects = (
  api: Api,
): Effect.Effect<{ readonly projects: readonly ProjectSummary[] }, AppFailure> =>
  api.call((client) => (client as unknown as TypedClient).listPortalProjects());

export const listPortalBugs = (
  api: Api,
): Effect.Effect<{ readonly bugs: readonly BugSummary[] }, AppFailure> =>
  api.call((client) => (client as unknown as TypedClient).listPortalBugs());

export const createPortalBug = (
  api: Api,
  key: string,
  input: { readonly description: string; readonly projectId: string; readonly title: string },
): Effect.Effect<{ readonly id: string }, AppFailure> =>
  api.call((client) =>
    (client as unknown as TypedClient).createPortalBug({ body: input, idempotencyKey: key }),
  );
