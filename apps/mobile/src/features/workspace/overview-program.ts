import { Effect } from "effect";

import { listProjects } from "@/features/workspace/queries";
import type { MobileApi } from "@/services/mobile-api";

/** The overview aggregates the project portfolio rows. */
export const projectsOverviewProgram = (api: MobileApi["Service"]) =>
  Effect.map(listProjects(api), (page) => ({
    rows: page.projects.map((project) => ({
      id: project.id,
      subtitle: `${project.openTasks} open · ${project.progress}% complete`,
      title: `${project.key} ${project.name}`,
    })),
  }));

/** Alias for the route files and tests. */
export const overviewProgram = projectsOverviewProgram;
