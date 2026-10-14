import type { Metadata } from "next";
import { connection } from "next/server";

import { listAllProjects } from "@/features/projects/projects-queries";

const projectMetadata = async (projectId: string): Promise<Metadata> => {
  await connection();
  const result = await listAllProjects();
  const project = result.ok
    ? result.data.find(({ id }) => id === projectId)
    : undefined;
  return { title: `${project?.name ?? "Project"} | Metsys` };
};

export { projectMetadata };
