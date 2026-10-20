/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  AllTasks,
  AllTasksSkeleton,
} from "@/features/tasks/components/all-tasks";
import { parseTaskIdParam } from "@/features/tasks/task-param";

export const metadata: Metadata = { title: "Tasks | Metsys" };

const TasksPage = ({ searchParams }: PageProps<"/tasks">) => (
  <PageTransition>
    <div className="page flush">
      <SectionErrorBoundary title="tasks could not be loaded">
        <SuspenseReveal fallback={<AllTasksSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => (
            <AllTasks initialTaskId={parseTaskIdParam(params["task"])} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default TasksPage;
