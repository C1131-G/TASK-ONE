/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  TeamList,
  TeamListSkeleton,
} from "@/features/people/components/team-list";

export const metadata: Metadata = { title: "Teams | Metsys" };

const TeamsPage = () => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Teams</h1>
        <p>Organize employees by team.</p>
      </div>
    </div>
    <SectionErrorBoundary title="teams could not be loaded">
      <Suspense fallback={<TeamListSkeleton />}>
        <TeamList />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default TeamsPage;
