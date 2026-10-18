/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the project files markup. */

import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const PROJECT_BLOCKS = SKELETON_KEYS.slice(0, 3);
const FILE_CARDS = SKELETON_KEYS.slice(0, 4);

const FileToolbarSkeleton = () => (
  <div className="panel-h file-toolbar" inert>
    <div className="file-search">
      <span className="skeleton-filter-select skeleton-search">
        Search files
      </span>
    </div>
    <div className="file-filter">
      <span className="skeleton-filter-select">
        All types
        <CaretDown aria-hidden="true" size={14} />
      </span>
    </div>
    <div className="file-sort">
      <span className="skeleton-filter-select">
        Sort: Newest
        <CaretDown aria-hidden="true" size={14} />
      </span>
    </div>
  </div>
);

// Mirrors WorkspaceFiles: each project block keeps its static heading link and
// toolbar; the project name and file cards are data.
const WorkspaceFilesSkeleton = () => (
  <>
    {PROJECT_BLOCKS.map((block) => (
      <section className="stack file-project" key={block}>
        <div className="row">
          <h2>
            <SkeletonBone shape="title" />
          </h2>
          <span className="sp" />
          <Link className="btn btn-sm btn-ghost" href="/projects">
            Open project files
          </Link>
        </div>
        <section className="panel project-files">
          <FileToolbarSkeleton />
          <SkelterSurface label="Loading project files…">
            <div className="file-results" data-layout="grid">
              {FILE_CARDS.map((key) => (
                <article className="file-card" key={key}>
                  <div aria-hidden="true" className="file-card-preview">
                    <SkeletonBone shape="short" />
                  </div>
                  <div className="file-card-main">
                    <SkeletonBone />
                    <SkeletonBone shape="short" />
                  </div>
                </article>
              ))}
            </div>
          </SkelterSurface>
        </section>
      </section>
    ))}
  </>
);

export { WorkspaceFilesSkeleton };
