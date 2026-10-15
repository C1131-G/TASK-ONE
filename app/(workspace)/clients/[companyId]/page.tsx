/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { clientCompanyMetadata } from "@/features/clients/client-company-metadata";
import {
  ClientCompanyDetailSkeleton,
  ClientCompanyDetailView,
} from "@/features/clients/components/client-company-detail";

export const generateMetadata = async ({
  params,
}: PageProps<"/clients/[companyId]">): Promise<Metadata> => {
  const { companyId } = await params;
  return await clientCompanyMetadata(companyId);
};

const ClientCompanyPage = ({ params }: PageProps<"/clients/[companyId]">) => (
  <div className="page">
    <Suspense fallback={<ClientCompanyDetailSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {params.then(({ companyId }) => (
        <ClientCompanyDetailView companyId={companyId} />
      ))}
    </Suspense>
  </div>
);

export default ClientCompanyPage;
