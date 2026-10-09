/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { searchWorkspaceAction } from "@/app/actions/discovery";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import type { WorkspaceSearchResults } from "@/src/server/preferences/discovery-contracts";

const SearchForm = ({
  recentSearches,
}: {
  readonly recentSearches: readonly string[];
}) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceSearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await searchWorkspaceAction({ query });
      if (!result.ok) {
        setError(result.error.message);
        setResults(null);
        return;
      }
      setError(null);
      setResults(result.data);
      router.refresh();
    });
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
                href={`/projects/${project.id}` as Route}
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
                href={`/projects/${task.projectId}` as Route}
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
            {recentSearches.map((item) => (
              <WorkspaceButton
                className="chip"
                key={item}
                onClick={() => setQuery(item)}
                type="button"
              >
                {item}
              </WorkspaceButton>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export { SearchForm };
