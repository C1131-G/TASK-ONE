/* eslint-disable shadcn/no-unknown-classes -- Workspace page classes are authored in app/workspace-styles. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { bugMetadata } from "@/features/bugs/bug-metadata";
import {
  BugDetail,
  BugDetailSkeleton,
} from "@/features/bugs/components/bug-detail";

export const instant = false;
export const generateMetadata = async ({
  params,
}: PageProps<"/bugs/[bugId]">): Promise<Metadata> => {
  const { bugId } = await params;
  return await bugMetadata(bugId);
};

const BugDetailPage = ({ params }: PageProps<"/bugs/[bugId]">) => (
  <div className="page flush">
    <Suspense fallback={<BugDetailSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {params.then(({ bugId }) => (
        <BugDetail bugId={bugId} />
      ))}
    </Suspense>
  </div>
);

export default BugDetailPage;
