/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";

export const metadata: Metadata = { title: "Favorites | Metsys" };

const FavoritesPage = async () => {
  await connection();
  const result = await getPersonalWorkspaceAction({});
  if (!result.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Favorites could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Favorites</h1>
          <p>Your saved projects and tasks.</p>
        </div>
      </div>
      <div className="grid2">
        <section className="panel">
          <div className="panel-h">
            <h2>Projects</h2>
          </div>
          {result.data.projects.map((project) => (
            <div className="mini" key={project.id}>
              <Link href={`/projects/${project.id}` as Route}>
                {project.name}
              </Link>
              <span className="sp" />
              <FavoriteToggle id={project.id} initialFavorite kind="project" />
            </div>
          ))}
          {result.data.projects.length === 0 ? (
            <p className="panel-b muted">No favorite projects yet.</p>
          ) : null}
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2>Tasks</h2>
          </div>
          {result.data.tasks.map((task) => (
            <div className="mini" key={task.id}>
              <Link href={`/projects/${task.projectId}` as Route}>
                {task.title}
              </Link>
              <span className="sp" />
              <FavoriteToggle id={task.id} initialFavorite kind="task" />
            </div>
          ))}
          {result.data.tasks.length === 0 ? (
            <p className="panel-b muted">No favorite tasks yet.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default FavoritesPage;
