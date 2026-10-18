/* eslint-disable shadcn/no-unknown-classes -- Workspace page classes are authored in app/workspace-styles. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { bugMetadata } from "@/features/bugs/bug-metadata";
import { BugDetail } from "@/features/bugs/components/bug-detail";
import { BugDetailSkeleton } from "@/features/bugs/components/bug-detail-skeleton";

export const generateMetadata = async ({
  params,
}: PageProps<"/bugs/[bugId]">): Promise<Metadata> => {
  const { bugId } = await params;
  return await bugMetadata(bugId);
};

const BugDetailPage = ({ params }: PageProps<"/bugs/[bugId]">) => (
  <div className="page flush">
    <SectionErrorBoundary title="Bug details could not be loaded">
      <Suspense fallback={<BugDetailSkeleton />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {params.then(({ bugId }) => (
          <BugDetail bugId={bugId} />
        ))}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default BugDetailPage;
