/* eslint-disable shadcn/no-unknown-classes -- Workspace page classes are authored in workspace-reference.css. */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  BugDetail,
  BugDetailSkeleton,
} from "@/features/bugs/components/bug-detail";

export const metadata: Metadata = { title: "Bug details | Metsys" };
export const instant = false;

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
