/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the bug detail markup. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const CLIENT_FACTS = [
  "Company",
  "Client impact",
  "First response",
  "Resolution",
] as const;
const DISCOVERY_FACTS = [
  "Found by",
  "Environment",
  "Browser / device",
] as const;
const STEP_CARDS = SKELETON_KEYS.slice(0, 2);

// Mirrors BugDetailWorkflow: the back link, section titles and fact labels are
// static; the bug's title, meta and every value are data.
const BugDetailSkeleton = () => (
  <article className="page bug-detail-page skeleton-fill">
    <Link className="bug-back-link" href="/bugs">
      <ArrowLeft aria-hidden="true" size={15} /> Bugs
    </Link>
    <SkelterSurface label="Loading bug details…">
      <header className="bug-detail-header">
        <div className="bug-detail-heading">
          <p className="eyebrow">
            <SkeletonBone shape="short" />
          </p>
          <SkeletonBone shape="title" />
          <p className="muted">
            <SkeletonBone />
          </p>
        </div>
      </header>
    </SkelterSurface>
    <section className="panel panel-b bug-detail-section bug-client-section">
      <h2>Client report</h2>
      <dl className="bug-client-facts">
        {CLIENT_FACTS.map((label) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <SkeletonBone shape="short" />
            </dd>
          </div>
        ))}
      </dl>
    </section>
    <section className="panel panel-b bug-detail-section">
      <h2>Discovery report</h2>
      <dl className="bug-client-facts">
        {DISCOVERY_FACTS.map((label) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <SkeletonBone shape="short" />
            </dd>
          </div>
        ))}
      </dl>
      <SkelterSurface label="Loading bug report…">
        <div className="grid2">
          {STEP_CARDS.map((key) => (
            <div className="panel panel-b" key={key}>
              <SkeletonBone shape="short" />
              <SkeletonBone />
              <SkeletonBone />
            </div>
          ))}
        </div>
      </SkelterSurface>
    </section>
  </article>
);

export { BugDetailSkeleton };
