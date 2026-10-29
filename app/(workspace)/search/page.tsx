/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  SearchPanel,
  SearchPanelSkeleton,
} from "@/features/discovery/components/search-panel";
import { parseSearchQuery } from "@/features/discovery/search-query";

export const metadata: Metadata = { title: "Search | Taskora" };

const SearchPage = ({ searchParams }: PageProps<"/search">) => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Search</h1>
          <p>Find projects and tasks in Taskora.</p>
        </div>
      </div>
      <SectionErrorBoundary title="Search couldn't load">
        <SuspenseReveal fallback={<SearchPanelSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => (
            <SearchPanel initialQuery={parseSearchQuery(params["q"])} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default SearchPage;
