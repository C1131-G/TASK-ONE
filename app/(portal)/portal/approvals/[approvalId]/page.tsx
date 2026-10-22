/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  PortalApprovalView,
  PortalApprovalViewSkeleton,
} from "@/features/portal/components/portal-approval-view";
import { getPortalApprovalById } from "@/features/portal/portal-approval-queries";

export const generateMetadata = async ({
  params,
}: PageProps<"/portal/approvals/[approvalId]">): Promise<Metadata> => {
  const { approvalId } = await params;
  const result = await getPortalApprovalById(approvalId);
  return {
    title: `${result.ok ? result.data.subjectTitle : "Approval"} | Metsys`,
  };
};

const Page = ({ params }: PageProps<"/portal/approvals/[approvalId]">) => (
  <PageTransition>
    <div className="page">
      <SectionErrorBoundary title="Approval details couldn't load">
        <SuspenseReveal fallback={<PortalApprovalViewSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {params.then(({ approvalId }) => (
            <PortalApprovalView approvalId={approvalId} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default Page;
