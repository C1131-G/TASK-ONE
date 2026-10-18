/* eslint-disable shadcn/no-unknown-classes -- Skeletons use workspace styles. */

"use client";

import type { ReactNode } from "react";
import { SkeletonIgnore, withSkeleton } from "react-zero-skeleton";

const SkeletonLayout = ({ children }: { readonly children: ReactNode }) => (
  <div className="skeleton-layout">{children}</div>
);

const MeasuredSkeleton = withSkeleton(SkeletonLayout);

// CSS bones remain visible in server HTML while Skelter measures the layout.
// Suspense fallbacks must not depend on hydration for their first frame.
const SkelterSurface = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) => (
  <section aria-busy="true" aria-label={label} className="skelter-surface">
    <output className="sr-only">{label}</output>
    <div aria-hidden="true" inert>
      <MeasuredSkeleton
        isLoadingSkeleton
        skeletonConfig={{
          animation: "wave",
          color: "var(--surface-3)",
          enter: "none",
          exit: "none",
          highlightColor: "var(--surface-2)",
        }}
      >
        {children}
      </MeasuredSkeleton>
    </div>
  </section>
);

// Static chrome (headings, column titles) stays readable inside a skeleton.
const SkeletonKeep = SkeletonIgnore;

export { SkeletonKeep, SkelterSurface };
