/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  SearchPanel,
  SearchPanelSkeleton,
} from "@/features/discovery/components/search-panel";
import { parseSearchQuery } from "@/features/discovery/search-query";

export const metadata: Metadata = { title: "Search | Metsys" };

const SearchPage = ({ searchParams }: PageProps<"/search">) => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Search</h1>
        <p>Find projects and tasks in Metsys.</p>
      </div>
    </div>
    <Suspense fallback={<SearchPanelSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {searchParams.then((params) => (
        <SearchPanel initialQuery={parseSearchQuery(params["q"])} />
      ))}
    </Suspense>
  </div>
);

export default SearchPage;
