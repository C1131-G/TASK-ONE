/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  FavoriteWork,
  FavoriteWorkSkeleton,
} from "@/features/discovery/components/favorite-work";

export const metadata: Metadata = { title: "Favorites | Metsys" };

const FavoritesPage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Favorites</h1>
          <p>Projects and tasks you&apos;ve starred for quick access.</p>
        </div>
      </div>
      <SectionErrorBoundary title="favorites could not be loaded">
        <SuspenseReveal fallback={<FavoriteWorkSkeleton />}>
          <FavoriteWork />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default FavoritesPage;
