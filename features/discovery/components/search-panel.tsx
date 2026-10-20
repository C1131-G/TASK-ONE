/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { SearchForm } from "@/features/discovery/components/search-form";
import {
  getPersonalWorkspace,
  getWorkspaceSearchResults,
} from "@/features/discovery/discovery-queries";

const SearchPanel = async ({
  initialQuery,
}: {
  readonly initialQuery: string;
}) => {
  const [workspace, search] = await Promise.all([
    getPersonalWorkspace({}),
    initialQuery.trim()
      ? getWorkspaceSearchResults({ query: initialQuery })
      : Promise.resolve(null),
  ]);
  return (
    <SearchForm
      initialResults={search?.ok ? search.data : null}
      initialError={search && !search.ok ? search.error.message : null}
      key={initialQuery}
      recentSearches={workspace.ok ? workspace.data.recentSearches : []}
    />
  );
};

const RESULT_ROWS = SKELETON_KEYS.slice(0, 5);

// Mirrors SearchForm: the search bar and result headings are static; the rows
// are data.
const SearchPanelSkeleton = () => (
  <div className="stack">
    <div className="panel panel-b">
      <div className="row" inert>
        <span className="skeleton-filter-select skeleton-search grow">
          Search projects and tasks
        </span>
        <span className="btn btn-primary">Search</span>
      </div>
    </div>
    <div className="grid2">
      <section className="panel">
        <div className="panel-h">
          <h2>Projects</h2>
        </div>
        <SkelterSurface label="Loading search…">
          {RESULT_ROWS.slice(0, 3).map((key) => (
            <div className="mini" key={key}>
              <SkeletonBone />
            </div>
          ))}
        </SkelterSurface>
      </section>
      <section className="panel">
        <div className="panel-h">
          <h2>Tasks</h2>
        </div>
        <SkelterSurface label="Loading task results…">
          {RESULT_ROWS.map((key) => (
            <div className="mini" key={key}>
              <SkeletonBone />
              <SkeletonBone shape="short" />
            </div>
          ))}
        </SkelterSurface>
      </section>
    </div>
  </div>
);

export { SearchPanel, SearchPanelSkeleton };
