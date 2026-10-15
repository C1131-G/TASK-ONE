/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { searchWorkspaceAction } from "@/features/discovery/discovery-actions";
import type { WorkspaceSearchResults } from "@/src/server/preferences/discovery-contracts";

const SearchForm = ({
  initialQuery,
  recentSearches,
}: {
  readonly initialQuery: string;
  readonly recentSearches: readonly string[];
}) => {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<WorkspaceSearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestGeneration = useRef(0);

  useEffect(() => {
    if (!initialQuery.trim()) {
      return;
    }
    requestGeneration.current += 1;
    const generation = requestGeneration.current;
    const loadInitialResults = async () => {
      try {
        const result = await searchWorkspaceAction({ query: initialQuery });
        if (generation !== requestGeneration.current) {
          return;
        }
        if (!result.ok) {
          setError(result.error.message);
          setResults(null);
          return;
        }
        setError(null);
        setResults(result.data);
      } catch {
        if (generation === requestGeneration.current) {
          setError("Search is temporarily unavailable. Try again.");
          setResults(null);
        }
      }
    };
    void loadInitialResults();
    return () => {
      if (generation === requestGeneration.current) {
        requestGeneration.current += 1;
      }
    };
  }, [initialQuery]);

  const executeSearch = (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return;
    }
    requestGeneration.current += 1;
    const generation = requestGeneration.current;
    setQuery(searchQuery);
    startTransition(async () => {
      try {
        const result = await searchWorkspaceAction({ query: trimmedQuery });
        if (generation !== requestGeneration.current) {
          return;
        }
        if (!result.ok) {
          setError(result.error.message);
          setResults(null);
          return;
        }
        setError(null);
        setResults(result.data);
        router.refresh();
      } catch {
        if (generation === requestGeneration.current) {
          setError("Search is temporarily unavailable. Try again.");
          setResults(null);
        }
      }
    });
  };

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    executeSearch(query);
  };

  return (
    <div className="stack">
      <search className="panel panel-b">
        <form className="row" onSubmit={search}>
          <label className="sr" htmlFor="workspace-search">
            Search projects and tasks
          </label>
          <WorkspaceInput
            autoComplete="off"
            className="input grow"
            id="workspace-search"
            maxLength={120}
            onChange={(event) => setQuery(event.currentTarget.value)}
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
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {results ? (
        <div className="grid2">
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
