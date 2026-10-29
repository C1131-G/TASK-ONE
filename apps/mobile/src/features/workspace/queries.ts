import type { Effect } from "effect";

import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";

export interface BugSummary {
  readonly clientCompanyName: string | null;
  readonly id: string;
  readonly priority: "high" | "low" | "medium" | "none" | "urgent";
  readonly reference: string;
  readonly status: string;
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
  api.call(async (client) => {
    const page = await client.listWorkspaceBugs({ query: {} });
    return {
      bugs: page.items.map((bug) => ({
        clientCompanyName: bug.clientCompanyName,
        id: bug.id,
        priority: bug.priority,
        reference: bug.reference,
        status: bug.status,
        title: bug.title,
      })),
    };
  });

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
