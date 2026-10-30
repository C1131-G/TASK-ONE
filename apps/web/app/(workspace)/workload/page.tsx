/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  WorkloadGrid,
  WorkloadGridSkeleton,
} from "@/features/workload/components/workload-grid";

export const metadata: Metadata = { title: "Workload | Taskora" };

const WorkloadPage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Workload</h1>
          <p>
            Open tasks and estimated hours per person over the next 8 weeks.
          </p>
        </div>
      </div>
      <SectionErrorBoundary title="Workload couldn't load">
        <SuspenseReveal fallback={<WorkloadGridSkeleton />}>
          <WorkloadGrid />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default WorkloadPage;
