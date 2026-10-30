/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { MyTime, MyTimeSkeleton } from "@/features/time/components/my-time";
import { parseDateParam } from "@/features/time/time-params";

export const metadata: Metadata = { title: "My Time | Taskora" };

const MyTimePage = ({ searchParams }: PageProps<"/my-time">) => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>My time</h1>
          <p>Track what you worked on and review your week.</p>
        </div>
      </div>
      <SectionErrorBoundary title="Your time couldn't load">
        <SuspenseReveal fallback={<MyTimeSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => (
            <MyTime date={parseDateParam(params["week"])} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default MyTimePage;
