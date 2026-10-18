/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles -- Skeletons share the real workspace layout classes. */

import { SkelterSurface } from "@/components/workspace/skelter-surface";

const SKELETON_KEYS = Array.from({ length: 42 }, (_, index) => `bone-${index}`);

const SkeletonBone = ({
  shape = "text",
}: {
  readonly shape?: "text" | "short" | "avatar" | "control" | "title" | "block";
}) => <span className={`sk skeleton-bone skeleton-${shape}`}>&nbsp;</span>;

const SkeletonToolbar = ({ count = 4 }: { readonly count?: number }) => (
  <div className="toolbar skeleton-toolbar">
    {SKELETON_KEYS.slice(0, count).map((key) => (
      <SkeletonBone key={key} shape="control" />
    ))}
  </div>
);

const SkeletonTabs = ({ count = 3 }: { readonly count?: number }) => (
  <div className="tabs skeleton-tabs">
    {SKELETON_KEYS.slice(0, count).map((key) => (
      <span className="tab" key={key}>
        <SkeletonBone shape="short" />
      </span>
    ))}
  </div>
);

const SkeletonRows = ({
  rows = 5,
  avatar = false,
}: {
  readonly rows?: number;
  readonly avatar?: boolean;
}) => (
  <div className="feed lined skeleton-feed">
    {SKELETON_KEYS.slice(0, rows).map((key) => (
      <div className="row skeleton-feed-row" key={key}>
        {avatar ? <SkeletonBone shape="avatar" /> : null}
        <div className="skeleton-copy grow">
          <SkeletonBone />
          <SkeletonBone shape="short" />
        </div>
        <SkeletonBone shape="short" />
      </div>
    ))}
  </div>
);

const SkeletonStats = ({ count = 4 }: { readonly count?: number }) => (
  <div className="stats skeleton-stats">
    {SKELETON_KEYS.slice(0, count).map((key) => (
      <div className="stat" key={key}>
        <span className="k">
          <SkeletonBone shape="short" />
        </span>
        <span className="v">
          <SkeletonBone shape="title" />
        </span>
        <span className="d">
          <SkeletonBone />
        </span>
      </div>
    ))}
  </div>
);

const SkeletonCards = ({ rows = 6 }: { readonly rows?: number }) => (
  <div className="pgrid">
    {SKELETON_KEYS.slice(0, rows).map((key) => (
      <article className="pcard skeleton-card" key={key}>
        <div className="row">
          <SkeletonBone shape="avatar" />
          <div className="grow">
            <SkeletonBone />
          </div>
          <SkeletonBone shape="short" />
        </div>
        <div className="desc skeleton-copy">
          <SkeletonBone />
          <SkeletonBone />
        </div>
        <SkeletonBone />
        <div className="foot">
          <SkeletonBone shape="short" />
          <SkeletonBone shape="short" />
        </div>
      </article>
    ))}
  </div>
);

const SkeletonTable = ({
  rows = 5,
  columns = 5,
}: {
  readonly rows?: number;
  readonly columns?: number;
}) => (
  <div className="skeleton-table-scroll">
    <table className="perm-t skeleton-table">
      <caption className="sr-only">Loading table</caption>
      <thead>
        <tr>
          {SKELETON_KEYS.slice(0, columns).map((key) => (
            <th key={key} scope="col">
              <SkeletonBone shape="short" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SKELETON_KEYS.slice(0, rows).map((key) => (
          <tr key={key}>
            {SKELETON_KEYS.slice(0, columns).map((column) => (
              <td key={column}>
                <SkeletonBone shape={column === "bone-0" ? "text" : "short"} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Skelter draws a bone for every td/th, so data tables are skeletoned as a grid:
// the column titles stay static outside the measured rows.
const SkeletonDataGrid = ({
  columns,
  label,
  rows = 10,
  widths,
}: {
  readonly columns: readonly string[];
  readonly label: string;
  readonly rows?: number;
  readonly widths: string;
}) => (
  <div className="skeleton-grid" style={{ "--cols": widths }}>
    <div aria-hidden="true" className="skeleton-grid-head">
      {columns.map((column) => (
        <span key={column}>{column}</span>
      ))}
    </div>
    <SkelterSurface label={label}>
      {SKELETON_KEYS.slice(0, rows).map((key) => (
        <div className="skeleton-grid-row" key={key}>
          {columns.map((column, index) => (
            <div key={column}>
              <SkeletonBone shape={index === 0 ? "text" : "short"} />
            </div>
          ))}
        </div>
      ))}
    </SkelterSurface>
  </div>
);

export {
  SkeletonDataGrid,
  SKELETON_KEYS,
  SkeletonBone,
  SkeletonCards,
  SkeletonRows,
  SkeletonStats,
  SkeletonTable,
  SkeletonTabs,
  SkeletonToolbar,
};
