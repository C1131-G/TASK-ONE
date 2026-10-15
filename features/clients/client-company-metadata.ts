import "server-only";
import type { Metadata } from "next";
import { cache } from "react";

import { getClientCompany } from "@/features/clients/clients-queries";

// Metadata and the page body both read the company; one request loads it once.
const getClientCompanyOnce = cache(
  async (companyId: string) => await getClientCompany({ companyId })
);

const clientCompanyMetadata = async (companyId: string): Promise<Metadata> => {
  const result = await getClientCompanyOnce(companyId);
  return {
    title: `${result.ok ? result.data.company.name : "Client"} | Metsys`,
  };
};

export { clientCompanyMetadata, getClientCompanyOnce };
