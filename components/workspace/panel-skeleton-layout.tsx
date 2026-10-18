/* eslint-disable shadcn/no-unknown-classes -- Match the existing workspace page layouts. */

import type { ReactNode } from "react";

import {
  SKELETON_KEYS,
  SkeletonBone,
  SkeletonRows,
  SkeletonStats,
  SkeletonTable,
  SkeletonTabs,
  SkeletonToolbar,
} from "@/components/workspace/skeleton-shapes";

type SkeletonVariant =
  | "list"
  | "tasks"
  | "settings"
  | "inbox"
  | "search"
  | "detail"
  | "member"
  | "overview"
  | "bugs";

const SkeletonPanel = ({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title?: string | undefined;
}) => (
  <div className="panel">
    {title ? (
      <div className="panel-h">
        <h2>{title}</h2>
      </div>
    ) : null}
    <div className="panel-b">{children}</div>
  </div>
);

const OverviewSkeleton = () => (
  <>
    <SkeletonStats />
    <div className="grid2 overview-grid">
      <SkeletonPanel title="Portfolio">
        <SkeletonTable columns={7} />
      </SkeletonPanel>
      <SkeletonPanel title="Tasks by status">
        <SkeletonRows rows={5} />
      </SkeletonPanel>
      <SkeletonPanel title="Workload">
        <SkeletonRows avatar rows={4} />
      </SkeletonPanel>
      <SkeletonPanel title="Upcoming milestones">
        <SkeletonRows rows={3} />
      </SkeletonPanel>
    </div>
  </>
);

const DetailSkeleton = ({ member = false }: { readonly member?: boolean }) => (
  <>
    <div className={member ? "member-profile-header" : "ph"}>
      <SkeletonBone shape="avatar" />
      <div className="skeleton-copy grow">
        <SkeletonBone shape="title" />
        <SkeletonBone />
      </div>
      <SkeletonBone shape="control" />
    </div>
    <SkeletonTabs count={4} />
    <SkeletonStats />
    <div className="grid2">
      <SkeletonPanel>
        <SkeletonRows rows={5} />
      </SkeletonPanel>
      <SkeletonPanel>
        <SkeletonRows avatar rows={4} />
      </SkeletonPanel>
    </div>
  </>
);

const SettingsSkeleton = () => (
  <div className="settings-shell">
    <SkeletonTabs count={4} />
    <div className="settings-content">
      <SkeletonPanel title="Appearance">
        <div className="skeleton-copy">
          <SkeletonBone shape="title" />
          <SkeletonBone />
        </div>
        <div className="settings-theme-options">
          {SKELETON_KEYS.slice(0, 3).map((key) => (
            <div className="settings-theme-choice" key={key}>
              <SkeletonBone shape="block" />
              <SkeletonBone />
            </div>
          ))}
        </div>
      </SkeletonPanel>
    </div>
  </div>
);

const PanelSkeletonLayout = ({
  variant,
  rows,
  title,
}: {
  readonly variant: SkeletonVariant;
  readonly rows: number;
  readonly title?: string | undefined;
}): ReactNode => {
  switch (variant) {
    case "overview": {
      return <OverviewSkeleton />;
    }
    case "settings": {
      return <SettingsSkeleton />;
    }
    case "detail": {
      return <DetailSkeleton />;
    }
    case "member": {
      return <DetailSkeleton member />;
    }
    case "tasks": {
      return (
        <>
          <SkeletonToolbar count={6} />
          <SkeletonTabs />
          <SkeletonPanel>
            <SkeletonRows rows={rows} />
          </SkeletonPanel>
        </>
      );
    }
    case "bugs": {
      return (
        <>
          <SkeletonToolbar count={2} />
          <SkeletonTabs count={6} />
          <SkeletonTabs />
          <SkeletonPanel>
            <SkeletonTable columns={6} rows={rows} />
          </SkeletonPanel>
        </>
      );
    }
    case "inbox": {
      return (
        <div className="inbox-workspace">
          <SkeletonPanel>
            <SkeletonToolbar count={2} />
            <SkeletonTabs count={4} />
            <SkeletonRows avatar rows={rows} />
          </SkeletonPanel>
          <SkeletonPanel>
            <SkeletonBone shape="title" />
            <SkeletonRows rows={3} />
          </SkeletonPanel>
        </div>
      );
    }
    case "search": {
      return (
        <>
          <SkeletonToolbar count={1} />
          <SkeletonPanel title="Recent searches">
            <SkeletonRows rows={rows} />
          </SkeletonPanel>
        </>
      );
    }
    default: {
      return (
        <SkeletonPanel title={title}>
          <SkeletonRows rows={rows} />
        </SkeletonPanel>
      );
    }
  }
};

export { PanelSkeletonLayout };
export type { SkeletonVariant };
