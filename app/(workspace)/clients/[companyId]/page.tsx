/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { clientCompanyMetadata } from "@/features/clients/client-company-metadata";
import {
  ClientCompanyDetailView,
  ClientCompanyDetailSkeleton,
} from "@/features/clients/components/client-company-detail";

export const generateMetadata = async ({
  params,
}: PageProps<"/clients/[companyId]">): Promise<Metadata> => {
  const { companyId } = await params;
  return await clientCompanyMetadata(companyId);
};

const ClientCompanyPage = ({ params }: PageProps<"/clients/[companyId]">) => (
  <div className="page">
    <SectionErrorBoundary title="Client company could not be loaded">
      <Suspense fallback={<ClientCompanyDetailSkeleton />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {params.then(({ companyId }) => (
          <ClientCompanyDetailView companyId={companyId} />
        ))}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default ClientCompanyPage;
