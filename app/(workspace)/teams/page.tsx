/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  TeamList,
  TeamListSkeleton,
} from "@/features/people/components/team-list";

export const instant = false;
export const metadata: Metadata = { title: "Teams | Metsys" };

const TeamsPage = () => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Teams</h1>
        <p>Organize employees by team.</p>
      </div>
    </div>
    <Suspense fallback={<TeamListSkeleton />}>
      <TeamList />
    </Suspense>
  </div>
);

export default TeamsPage;
