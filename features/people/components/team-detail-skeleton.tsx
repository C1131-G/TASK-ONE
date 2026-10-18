/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the team overview markup. */

import {
  Briefcase,
  CheckCircle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const SECTIONS = [
  { Icon: Briefcase, title: "Projects" },
  { Icon: CheckCircle, title: "Open tasks" },
  { Icon: UsersThree, title: "Members" },
] as const;
const SECTION_ROWS = SKELETON_KEYS.slice(0, 3);

// Mirrors TeamOverview: section titles are static; the team name, counts and
// rows are data.
const TeamDetailSkeleton = () => (
  <div className="team-overview">
    <header className="ph team-overview-heading">
      <div>
        <div className="team-overview-title">
          <SkeletonBone shape="title" />
        </div>
        <p>Projects and people in this team.</p>
      </div>
    </header>
    <div className="team-overview-grid">
      {SECTIONS.map(({ Icon, title }) => (
        <section className="panel" key={title}>
          <div className="panel-h team-overview-section-heading">
            <div className="team-section-title">
              <Icon aria-hidden="true" size={18} />
              <h2>{title}</h2>
            </div>
            <span className="ct">
              <SkeletonBone shape="short" />
            </span>
          </div>
          <SkelterSurface label={`Loading team ${title.toLowerCase()}…`}>
            <div className="panel-b stack">
              {SECTION_ROWS.map((key) => (
                <SkeletonBone key={key} />
              ))}
            </div>
          </SkelterSurface>
        </section>
      ))}
    </div>
  </div>
);

export { TeamDetailSkeleton };
