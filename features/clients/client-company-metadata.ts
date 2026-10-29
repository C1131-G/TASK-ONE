import "server-only";
import type { Metadata } from "next";

import { getClientCompanyOnce } from "@/features/clients/clients-queries";

const clientCompanyMetadata = async (companyId: string): Promise<Metadata> => {
  const result = await getClientCompanyOnce(companyId);
  return {
    title: `${result.ok ? result.data.company.name : "Client"} | Taskora`,
  };
};

export { clientCompanyMetadata };
