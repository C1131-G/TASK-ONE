import type { Metadata } from "next";

import { listAllTeams } from "@/features/people/people-queries";

const teamMetadata = async (teamId: string): Promise<Metadata> => {
  const result = await listAllTeams();
  const team = result.ok
    ? result.data.find(({ id }) => id === teamId)
    : undefined;
  return { title: `${team?.name ?? "Team"} | Taskora` };
};

export { teamMetadata };
