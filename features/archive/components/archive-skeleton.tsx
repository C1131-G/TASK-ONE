/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the archive markup. */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const ARCHIVE_ROWS = SKELETON_KEYS.slice(0, 5);

// Mirrors ArchiveWorkspace: the tab labels are static; the rows are data.
const ArchivedWorkSkeleton = () => (
  <section aria-label="Archived work" className="archive-workspace">
    <Tabs value="tasks">
      <TabsList aria-label="Choose archived work type" inert>
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
        <TabsTrigger value="projects">Projects</TabsTrigger>
      </TabsList>
    </Tabs>
    <SkelterSurface label="Loading archived work…">
      <div className="archive-list">
        {ARCHIVE_ROWS.map((key) => (
          <article className="archive-row" key={key}>
            <div className="archive-row-main">
              <SkeletonBone />
              <SkeletonBone shape="short" />
            </div>
            <SkeletonBone shape="control" />
          </article>
        ))}
      </div>
    </SkelterSurface>
  </section>
);

export { ArchivedWorkSkeleton };
