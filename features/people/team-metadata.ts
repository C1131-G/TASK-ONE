import type { Metadata } from "next";
import { connection } from "next/server";

import { listAllTeams } from "@/features/people/people-queries";

const teamMetadata = async (teamId: string): Promise<Metadata> => {
  await connection();
  const result = await listAllTeams();
  const team = result.ok
    ? result.data.find((item) => item.id === teamId)
    : undefined;
  return { title: `${team?.name ?? "Team"} | Metsys` };
};

export { teamMetadata };
