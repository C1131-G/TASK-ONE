import type { Metadata } from "next";

import { listAllProjects } from "@/features/projects/projects-queries";

const projectMetadata = async (projectId: string): Promise<Metadata> => {
  const result = await listAllProjects();
  const project = result.ok
    ? result.data.find(({ id }) => id === projectId)
    : undefined;
  return { title: `${project?.name ?? "Project"} | Taskora` };
};

export { projectMetadata };
