/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the favorites markup. */

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { ProjectCardSkeleton } from "@/features/projects/components/directory-skeleton";

const FAVORITE_PROJECTS = SKELETON_KEYS.slice(0, 3);
const FAVORITE_TASKS = SKELETON_KEYS.slice(0, 6);

// Mirrors FavoriteWork: section headings are static; counts, project cards and
// task rows are data.
const FavoriteWorkSkeleton = () => (
  <>
    <section className="stack">
      <h2 className="section-heading">Projects</h2>
      <SkelterSurface label="Loading favorite projects…">
        <div className="pgrid">
          {FAVORITE_PROJECTS.map((key) => (
            <ProjectCardSkeleton key={key} />
          ))}
        </div>
      </SkelterSurface>
    </section>
    <section className="stack">
      <h2 className="section-heading">Tasks</h2>
      <SkelterSurface label="Loading favorite tasks…">
        <div className="panel favorite-task-list">
          {FAVORITE_TASKS.map((key) => (
            <article className="favorite-task-row" key={key}>
              <div className="favorite-task-main">
                <SkeletonBone />
                <SkeletonBone shape="short" />
                <div className="favorite-task-metadata">
                  <SkeletonBone shape="short" />
                  <SkeletonBone shape="short" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </SkelterSurface>
    </section>
  </>
);

export { FavoriteWorkSkeleton };
