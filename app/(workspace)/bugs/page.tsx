/* eslint-disable shadcn/no-unknown-classes -- Bug screens use reference workspace styles from app/workspace-styles. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { parseBugFilters } from "@/features/bugs/bug-filters";
import {
  BugTracker,
  BugTrackerSkeleton,
} from "@/features/bugs/components/bug-tracker";

export const metadata: Metadata = { title: "Bugs | Metsys" };

const BugsPage = ({ searchParams }: PageProps<"/bugs">) => (
  <div className="page flush">
    <Suspense fallback={<BugTrackerSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {searchParams.then((params) => (
        <BugTracker filters={parseBugFilters(params)} />
      ))}
    </Suspense>
  </div>
);

export default BugsPage;
