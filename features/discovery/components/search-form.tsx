/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { recordRecentSearchAction } from "@/features/discovery/discovery-actions";
import type { WorkspaceSearchResults } from "@/src/server/preferences/discovery-contracts";

const searchHref = (query: string) =>
  `/search?q=${encodeURIComponent(query)}` as const;

// The recent-search list is a convenience; a failed write never holds up or
// fails the search itself.
const recordRecentSearch = async (query: string) => {
  try {
    await recordRecentSearchAction({ query });
  } catch {
    // Intentionally ignored.
  }
};

const SearchForm = ({
  initialResults,
  initialError,
  recentSearches,
}: {
  readonly initialResults: WorkspaceSearchResults | null;
  readonly initialError: string | null;
  readonly recentSearches: readonly string[];
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const results = initialResults;

  const executeSearch = (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return;
    }
    setQuery(searchQuery);
    startTransition(() => {
      router.push(searchHref(trimmedQuery));
    });
    void recordRecentSearch(trimmedQuery);
  };

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    executeSearch(query);
  };

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    const trimmedQuery = nextQuery.trim();
    if (trimmedQuery) {
      router.prefetch(searchHref(trimmedQuery));
    }
  };

  return (
    <div className="stack">
      <search className="panel panel-b">
        <form className="row" key={searchParams.toString()} onSubmit={search}>
          <label className="sr" htmlFor="workspace-search">
            Search projects and tasks
          </label>
          <WorkspaceInput
            autoComplete="off"
            className="input grow"
            id="workspace-search"
            maxLength={120}
            onChange={(event) => updateQuery(event.currentTarget.value)}
            placeholder="Search projects and tasks"
            value={query}
          />
          <WorkspaceButton
            className="btn btn-primary"
            disabled={pending || !query.trim()}
            type="submit"
          >
            {pending ? "Searching…" : "Search"}
          </WorkspaceButton>
        </form>
      </search>
      {initialError ? (
        <p className="error" role="alert">
          {initialError}
        </p>
      ) : null}
      {results ? (
        <div
          aria-busy={pending}
          className="grid2 transition-opacity data-pending:opacity-60"
          data-pending={pending ? "" : undefined}
        >
          <section className="panel">
            <div className="panel-h">
              <h2>Projects</h2>
            </div>
            {results.projects.map((project) => (
              <Link
                className="mini"
                href={`/projects/${project.id}`}
                key={project.id}
              >
                {project.name}
              </Link>
            ))}
            {results.projects.length === 0 ? (
              <p className="panel-b muted">No matching projects.</p>
            ) : null}
          </section>
          <section className="panel">
            <div className="panel-h">
              <h2>Tasks</h2>
            </div>
            {results.tasks.map((task) => (
              <Link
                className="mini"
                href={`/projects/${task.projectId}?task=${task.id}`}
                key={task.id}
              >
                <span className="trunc grow">{task.title}</span>
                <span className="muted">{task.projectName}</span>
              </Link>
            ))}
            {results.tasks.length === 0 ? (
              <p className="panel-b muted">No matching tasks.</p>
            ) : null}
          </section>
        </div>
      ) : null}
      {recentSearches.length ? (
        <section className="panel">
          <div className="panel-h">
            <h2>Recent searches</h2>
          </div>
          <div className="panel-b row">
            {recentSearches.map((recentQuery) => (
              <WorkspaceButton
                className="chip"
                key={recentQuery}
                onClick={() => executeSearch(recentQuery)}
                type="button"
              >
                {recentQuery}
              </WorkspaceButton>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export { SearchForm };
