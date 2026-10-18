/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the workspace timeline markup. */

import { CaretDown } from "@phosphor-icons/react/dist/ssr";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import {
  SkeletonKeep,
  SkelterSurface,
} from "@/components/workspace/skelter-surface";

const TIMELINE_ROWS = SKELETON_KEYS.slice(0, 16);
const SELECTS = [
  "All statuses",
  "All priorities",
  "All assignees",
  "Sort: Manual",
  "Group: Project",
] as const;

// Mirrors WorkspaceTimeline: controls and the "Task" column title are static,
// task names and bars are data.
const ProjectTimelineSkeleton = () => (
  <section
    aria-label="Workspace task timeline"
    className="panel timeline-panel"
  >
    <div className="panel-h timeline-panel-header">
      <h2>Work timeline</h2>
      <div className="toolbar timeline-toolbar" inert>
        <span className="skeleton-filter-select skeleton-search">
          Search tasks
        </span>
        {SELECTS.map((label) => (
          <span className="skeleton-filter-select" key={label}>
            {label}
            <CaretDown aria-hidden="true" size={14} />
          </span>
        ))}
        <span className="timeline-scale">
          <span className="btn btn-secondary">Weeks</span>
          <span className="btn btn-ghost">Months</span>
        </span>
        <span className="btn btn-outline">Today</span>
      </div>
    </div>
    <SkelterSurface label="Loading timeline…">
      <div className="tl workspace-timeline">
        <div className="tl-left">
          <div className="tl-head">
            <SkeletonKeep>Task</SkeletonKeep>
          </div>
          <ul className="tl-rows">
            {TIMELINE_ROWS.map((key) => (
              <li className="tl-row" key={key}>
                <SkeletonBone />
              </li>
            ))}
          </ul>
        </div>
        <div className="tl-right">
          <div className="tl-head skeleton-tl-head">
            <SkeletonBone shape="short" />
          </div>
          <div className="tl-grid skeleton-tl-grid">
            {TIMELINE_ROWS.map((key) => (
              <div className="skeleton-tl-row" key={key}>
                <SkeletonBone shape="short" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkelterSurface>
  </section>
);

export { ProjectTimelineSkeleton };
