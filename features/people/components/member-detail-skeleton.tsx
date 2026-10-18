/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the member profile markup. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const STATS = [
  "Active projects",
  "Assigned tasks",
  "Completed tasks",
  "Overdue",
] as const;
const TASK_ROWS = SKELETON_KEYS.slice(0, 5);
const SIDE_ROWS = SKELETON_KEYS.slice(0, 3);

// Mirrors MemberProfile: the back link, stat labels and panel titles are
// static; the person, counts and rows are data.
const MemberDetailSkeleton = () => (
  <div className="page member-profile-page">
    <Link className="member-profile-back" href="/members">
      <ArrowLeft aria-hidden="true" size={14} />
      All members
    </Link>
    <SkelterSurface label="Loading member profile…">
      <header className="member-profile-header">
        <SkeletonBone shape="avatar" />
        <div className="member-profile-identity">
          <div className="member-profile-name-row">
            <SkeletonBone shape="title" />
          </div>
          <p className="member-profile-job">
            <SkeletonBone />
          </p>
          <p className="member-profile-email">
            <SkeletonBone />
          </p>
        </div>
      </header>
    </SkelterSurface>
    <div className="stats member-profile-stats">
      {STATS.map((label) => (
        <div className="stat" key={label}>
          <span className="k">{label}</span>
          <span className="v">
            <SkeletonBone shape="short" />
          </span>
        </div>
      ))}
    </div>
    <div className="member-profile-grid">
      <section aria-label="Assigned tasks" className="panel">
        <nav aria-label="Member task filters" className="member-profile-tabs">
          <Link aria-current="page" href="/members">
            Assigned
          </Link>
          <Link href="/members">Completed</Link>
        </nav>
        <SkelterSurface label="Loading member tasks…">
          {TASK_ROWS.map((key) => (
            <div className="row skeleton-feed-row" key={key}>
              <div className="skeleton-copy grow">
                <SkeletonBone />
                <SkeletonBone shape="short" />
              </div>
              <SkeletonBone shape="short" />
            </div>
          ))}
        </SkelterSurface>
      </section>
      <div className="member-profile-side">
        <section className="panel">
          <div className="panel-h">
            <h2>Active projects</h2>
          </div>
          <SkelterSurface label="Loading member projects…">
            <div className="panel-b stack">
              {SIDE_ROWS.map((key) => (
                <SkeletonBone key={key} />
              ))}
            </div>
          </SkelterSurface>
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2>Recent activity</h2>
          </div>
          <SkelterSurface label="Loading member activity…">
            <div className="panel-b stack">
              {SIDE_ROWS.map((key) => (
                <SkeletonBone key={key} />
              ))}
            </div>
          </SkelterSurface>
        </section>
      </div>
    </div>
  </div>
);

export { MemberDetailSkeleton };
