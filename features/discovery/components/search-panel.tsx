/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in workspace-reference.css. */

import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { SearchForm } from "@/features/discovery/components/search-form";
import { getPersonalWorkspace } from "@/features/discovery/discovery-queries";

const SearchPanel = async ({
  initialQuery,
}: {
  readonly initialQuery: string;
}) => {
  await connection();
  const result = await getPersonalWorkspace({});
  return (
    <SearchForm
      initialQuery={initialQuery}
      key={initialQuery}
      recentSearches={result.ok ? result.data.recentSearches : []}
    />
  );
};

const SearchPanelSkeleton = () => (
  <PanelSkeleton label="Loading search…" rows={3} />
);

export { SearchPanel, SearchPanelSkeleton };
