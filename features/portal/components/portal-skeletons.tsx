/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import {
  SKELETON_KEYS,
  SkeletonBone,
  SkeletonRows,
  SkeletonToolbar,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const PortalListSkeleton = ({ label }: { readonly label: string }) => (
  <SkelterSurface label={label}>
    <div className="ph">
      <SkeletonBone shape="title" />
      <SkeletonBone shape="control" />
    </div>
    <SkeletonToolbar count={3} />
    <ul className="portal-bug-list">
      {SKELETON_KEYS.slice(0, 4).map((key) => (
        <li key={key}>
          <div className="portal-bug-card">
            <div className="portal-bug-top">
              <SkeletonBone shape="short" />
              <SkeletonBone shape="short" />
            </div>
            <SkeletonBone shape="title" />
            <div className="portal-bug-meta">
              <SkeletonBone />
              <SkeletonBone shape="short" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  </SkelterSurface>
);

const PortalFormSkeleton = ({
  label = "Loading bug form",
}: {
  readonly label?: string;
}) => (
  <>
    <div className="ph">
      <div>
        <h1>Report a bug</h1>
        <p>
          Tell us what went wrong. The more detail you give, the faster we can
          fix it.
        </p>
      </div>
    </div>
    <SkelterSurface label={label}>
      <div className="panel portal-panel">
        <div className="portal-form">
          {SKELETON_KEYS.slice(0, 7).map((key) => (
            <div className="field skeleton-copy" key={key}>
              <SkeletonBone shape="short" />
              <SkeletonBone
                shape={
                  key === "bone-2" || key === "bone-4" ? "block" : "control"
                }
              />
            </div>
          ))}
          <SkeletonBone shape="control" />
        </div>
      </div>
    </SkelterSurface>
  </>
);

const PortalAccountSkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Account</h1>
        <p>Your details, password and notification settings.</p>
      </div>
    </div>
    <SkelterSurface label="Loading account">
      <div className="portal-account">
        {["Profile", "Change password", "Push notifications", "Sign out"].map(
          (title) => (
            <div className="panel portal-panel" key={title}>
              <h2 className="sec">{title}</h2>
              <SkeletonRows rows={title === "Change password" ? 3 : 1} />
            </div>
          )
        )}
      </div>
    </SkelterSurface>
  </>
);

const PortalNotificationsSkeleton = () => (
  <SkelterSurface label="Loading notifications">
    <div className="panel">
      <div className="panel-h portal-notif-bar">
        <SkeletonBone shape="title" />
        <SkeletonBone shape="control" />
      </div>
      <div className="panel-b">
        <SkeletonRows rows={5} />
      </div>
    </div>
  </SkelterSurface>
);

const PortalDetailSkeleton = () => (
  <SkelterSurface label="Loading bug">
    <div className="portal-detail">
      <div className="portal-back">
        <SkeletonBone shape="short" />
      </div>
      <div className="portal-bug-head skeleton-copy">
        <SkeletonBone shape="short" />
        <SkeletonBone shape="title" />
        <SkeletonBone />
      </div>
      <div className="portal-detail-grid">
        <div className="portal-detail-main">
          {SKELETON_KEYS.slice(0, 3).map((key) => (
            <div className="panel portal-panel" key={key}>
              <SkeletonBone shape="title" />
              <SkeletonRows rows={3} />
            </div>
          ))}
        </div>
        <div className="portal-detail-side">
          <div className="panel portal-panel">
            <SkeletonBone shape="title" />
            <SkeletonRows rows={4} />
          </div>
        </div>
      </div>
    </div>
  </SkelterSurface>
);

export {
  PortalAccountSkeleton,
  PortalDetailSkeleton,
  PortalFormSkeleton,
  PortalListSkeleton,
  PortalNotificationsSkeleton,
};
