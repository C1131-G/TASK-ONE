/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  FavoriteWork,
  FavoriteWorkSkeleton,
} from "@/features/discovery/components/favorite-work";

export const metadata: Metadata = { title: "Favorites | Metsys" };

const FavoritesPage = () => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Favorites</h1>
        <p>Projects and tasks you&apos;ve starred for quick access.</p>
      </div>
    </div>
    <SectionErrorBoundary title="favorites could not be loaded">
      <Suspense fallback={<FavoriteWorkSkeleton />}>
        <FavoriteWork />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default FavoritesPage;
