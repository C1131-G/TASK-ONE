/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  PortalReport,
  PortalFormSkeleton,
} from "@/features/portal/components/portal-report";
import { parsePortalReportFrom } from "@/features/portal/portal-filters";

export const metadata: Metadata = {
  description: "Report a bug on one of your projects.",
  title: "Report a bug | Metsys",
};

const Page = ({ searchParams }: PageProps<"/portal/new">) => (
  <PageTransition>
    <div className="page portal-narrow">
      <div className="ph">
        <div>
          <h1>Report a bug</h1>
          <p>
            Tell us what went wrong. The more detail you give, the faster we can
            fix it.
          </p>
        </div>
      </div>
      <SectionErrorBoundary title="Bug report form couldn't load">
        <SuspenseReveal
          fallback={<PortalFormSkeleton label="Loading bug form" />}
        >
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => (
            <PortalReport from={parsePortalReportFrom(params)} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default Page;
