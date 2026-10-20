/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
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
  <PageTransition>
    <div className="page">
      <SectionErrorBoundary title="Client company could not be loaded">
        <SuspenseReveal fallback={<ClientCompanyDetailSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {params.then(({ companyId }) => (
            <ClientCompanyDetailView companyId={companyId} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default ClientCompanyPage;
