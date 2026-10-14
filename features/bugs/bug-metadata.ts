import type { Metadata } from "next";

import { getBug } from "@/features/bugs/bugs-queries";

const bugMetadata = async (bugId: string): Promise<Metadata> => {
  const result = await getBug({ bugId });
  const title = result.ok
    ? `${result.data.projectKey}-${result.data.projectTaskNumber} ${result.data.title}`
    : "Bug details";
  return { title: `${title} | Metsys` };
};

export { bugMetadata };
