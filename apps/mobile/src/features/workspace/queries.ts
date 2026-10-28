import type { Effect } from "effect";

import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";

export interface BugSummary {
  readonly id: string;
  readonly priority: "high" | "low" | "medium" | "urgent";
  readonly projectId: string;
  readonly projectName: string;
  readonly status: "confirmed" | "fixed" | "open" | "rejected";
  readonly title: string;
}

export interface ProjectSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly openTasks: number;
  readonly progress: number;
}

type Api = MobileApi["Service"];

interface TypedClient {
  readonly listBugs: () => Promise<{ readonly bugs: readonly BugSummary[] }>;
  readonly listProjects: () => Promise<{
    readonly items: readonly {
      readonly id: string;
      readonly key: string;
      readonly name: string;
      readonly openTaskCount: number;
      readonly progress: number;
    }[];
  }>;
}

export const listBugs = (api: Api): Effect.Effect<{ readonly bugs: readonly BugSummary[] }, AppFailure> =>
  api.call((client) => (client as unknown as TypedClient).listBugs());

export const listProjects = (
  api: Api,
): Effect.Effect<{ readonly projects: readonly ProjectSummary[] }, AppFailure> =>
  api.call(async (client) => {
    const page = await (client as unknown as TypedClient).listProjects();
    return {
      projects: page.items.map((project) => ({
        id: project.id,
        key: project.key,
        name: project.name,
        openTasks: project.openTaskCount,
        progress: project.progress,
      })),
    };
  });
