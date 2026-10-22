/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  GithubPanel,
  GithubPanelSkeleton,
} from "@/features/github/components/github-panel";

export const metadata: Metadata = { title: "GitHub | Metsys" };

const GithubPage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>GitHub</h1>
          <p>
            Link pull requests to tasks and optionally complete a task when its
            pull request merges.
          </p>
        </div>
      </div>
      <SectionErrorBoundary title="GitHub couldn't load">
        <SuspenseReveal fallback={<GithubPanelSkeleton />}>
          <GithubPanel />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default GithubPage;
