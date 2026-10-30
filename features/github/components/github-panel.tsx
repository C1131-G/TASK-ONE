/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in apps/web/app/workspace-styles. */

import { redirect } from "next/navigation";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { listGithubConnections } from "@/features/github/github-queries";
import { listAllProjects } from "@/features/projects/projects-queries";
import { readOrThrow } from "@/lib/read-result";
import { getPageSession } from "@/src/server/auth/page-session";

import { GithubConnectionCard } from "./github-connection-card";
import { GithubConnectionForm } from "./github-connection-form";

const GithubPanel = async () => {
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    redirect("/");
  }
  const [connections, projects] = await Promise.all([
    listGithubConnections({}),
    listAllProjects(),
  ]);
  const connected = readOrThrow(connections, "GitHub connections");
  const choices = readOrThrow(projects, "Projects").map(
    ({ id, key, name }) => ({
      id,
      label: `${key} ${name}`,
    })
  );
  return (
    <div className="stack">
      <GithubConnectionForm projects={choices} />
      {connected.length === 0 ? (
        <section className="panel panel-b">
          <h2>No repositories yet</h2>
          <p className="muted">
            Connect a repository above to link its pull requests to tasks.
          </p>
        </section>
      ) : (
        connected.map((connection) => (
          <GithubConnectionCard connection={connection} key={connection.id} />
        ))
      )}
    </div>
  );
};

const GithubPanelSkeleton = () => (
  <PanelSkeleton label="Loading GitHub…" rows={3} title="GitHub" />
);

export { GithubPanel, GithubPanelSkeleton };
