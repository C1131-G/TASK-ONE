/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the project directory markup. */

import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const PROJECT_CARDS = SKELETON_KEYS.slice(0, 6);
const VIEWS = ["Grid", "List", "Table"] as const;

const ProjectCardSkeleton = () => (
  <article className="pcard">
    <div className="pcard-link">
      <div className="row">
        <SkeletonBone shape="avatar" />
        <strong className="grow">
          <SkeletonBone />
        </strong>
        <SkeletonBone shape="short" />
      </div>
      <p className="desc">
        <SkeletonBone />
      </p>
      <div className="row">
        <span className="prog skeleton-prog">
          <SkeletonBone />
        </span>
        <SkeletonBone shape="short" />
      </div>
      <div className="foot">
        <SkeletonBone shape="short" />
        <span className="sp" />
        <SkeletonBone shape="short" />
        <SkeletonBone shape="short" />
      </div>
    </div>
  </article>
);

// Mirrors ProjectDirectory: the filter bar and layout tabs are static; the
// counts and every project card are data.
const ProjectDirectorySkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Projects</h1>
        <p>
          <SkeletonBone />
        </p>
      </div>
    </div>
    <div className="toolbar project-toolbar" inert>
      <span className="skeleton-filter-select skeleton-search project-search">
        Search projects
      </span>
      <span className="skeleton-filter-select">
        All statuses
        <CaretDown aria-hidden="true" size={14} />
      </span>
      <span className="skeleton-filter-select">
        Recently active
        <CaretDown aria-hidden="true" size={14} />
      </span>
      <span className="btn btn-sm btn-secondary">Apply</span>
    </div>
    <nav aria-label="Project layout" className="tabs project-view-tabs">
      {VIEWS.map((view) => (
        <Link
          aria-current={view === "Grid" ? "page" : undefined}
          className={`tab${view === "Grid" ? " on" : ""}`}
          href="/projects"
          key={view}
        >
          {view}
        </Link>
      ))}
    </nav>
    <SkelterSurface label="Loading projects…">
      <div className="pgrid">
        {PROJECT_CARDS.map((key) => (
          <ProjectCardSkeleton key={key} />
        ))}
      </div>
    </SkelterSurface>
  </>
);

export { ProjectCardSkeleton, ProjectDirectorySkeleton };
