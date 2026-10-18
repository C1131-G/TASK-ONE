/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the project detail markup. */

import {
  Bug,
  CalendarBlank,
  ChartLineUp,
  Files,
  List,
  Pulse,
  CaretDown,
  SquaresFour,
  Table,
} from "@phosphor-icons/react/dist/ssr";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const VIEWS = [
  { Icon: SquaresFour, label: "Overview" },
  { Icon: SquaresFour, label: "Board" },
  { Icon: List, label: "List" },
  { Icon: Table, label: "Table" },
  { Icon: Bug, label: "Bugs" },
  { Icon: CalendarBlank, label: "Calendar" },
  { Icon: ChartLineUp, label: "Timeline" },
  { Icon: Files, label: "Files" },
  { Icon: Pulse, label: "Activity" },
] as const;
const COLUMNS = ["Backlog", "To Do", "In Progress", "Review", "Done"] as const;
const COLUMN_CARDS = SKELETON_KEYS.slice(0, 3);

// Mirrors ProjectDetail on its default board view: the "Projects /" crumb, the
// view tabs, the board controls and column names are static; the project name,
// meta and every card are data.
const ProjectDetailSkeleton = () => (
  <div className="page flush">
    <div className="proj-h">
      <div className="row">
        <SkeletonBone shape="avatar" />
        <span className="faint">Projects</span>
        <span className="sep">/</span>
        <h1>
          <SkeletonBone shape="title" />
        </h1>
      </div>
      <p>
        <SkeletonBone />
      </p>
      <div className="row project-meta">
        <SkeletonBone shape="short" />
        <SkeletonBone shape="short" />
      </div>
      <nav aria-label="Project views" className="tabs project-tabs">
        {VIEWS.map(({ Icon, label }) => (
          <span className={`tab${label === "Board" ? " on" : ""}`} key={label}>
            <Icon aria-hidden="true" size={14} />
            {label}
          </span>
        ))}
      </nav>
    </div>
    <div className="project-board-wrap">
      <div aria-hidden="true" className="board-toolbar">
        <span className="skeleton-filter-select skeleton-search board-search">
          Search tasks...
        </span>
        <span className="skeleton-filter-select">
          All priorities
          <CaretDown aria-hidden="true" size={14} />
        </span>
        <span className="skeleton-filter-select">
          Manual order
          <CaretDown aria-hidden="true" size={14} />
        </span>
      </div>
      <SkelterSurface label="Loading project…">
        <div className="board">
          {COLUMNS.map((column) => (
            <section className="bcol" key={column}>
              <header className="bcol-h">
                <span aria-hidden="true" className="st" />
                <SkeletonBone shape="short" />
              </header>
              <div className="bcol-b">
                {COLUMN_CARDS.map((key) => (
                  <div className="kcard" key={key}>
                    <div className="top">
                      <SkeletonBone shape="short" />
                      <SkeletonBone />
                    </div>
                    <div className="meta">
                      <SkeletonBone shape="short" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SkelterSurface>
    </div>
  </div>
);

export { ProjectDetailSkeleton };
