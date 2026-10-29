import type { Metadata } from "next";

import { getPortalBugById } from "@/features/portal/portal-queries";

const portalBugMetadata = async (bugId: string): Promise<Metadata> => {
  const result = await getPortalBugById(bugId);
  const title = result.ok
    ? `${result.data.key} ${result.data.title}`
    : "Bug details";
  return { title: `${title} | Taskora` };
};

export { portalBugMetadata };
