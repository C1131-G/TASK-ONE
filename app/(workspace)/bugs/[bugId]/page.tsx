/* eslint-disable shadcn/no-unknown-classes -- Workspace page classes are authored in app/workspace-styles. */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { bugMetadata } from "@/features/bugs/bug-metadata";
import {
  BugDetail,
  BugDetailSkeleton,
} from "@/features/bugs/components/bug-detail";

export const generateMetadata = async ({
  params,
}: PageProps<"/bugs/[bugId]">): Promise<Metadata> => {
  const { bugId } = await params;
  return await bugMetadata(bugId);
};

const BugDetailPage = ({ params }: PageProps<"/bugs/[bugId]">) => (
  <PageTransition>
    <div className="page flush">
      <SectionErrorBoundary title="Bug details could not be loaded">
        <SuspenseReveal fallback={<BugDetailSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {params.then(({ bugId }) => (
            <BugDetail bugId={bugId} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default BugDetailPage;
