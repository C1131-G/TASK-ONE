/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { InboxFeed } from "@/features/notifications/components/inbox-feed";

export const metadata: Metadata = { title: "Inbox | Metsys" };

const InboxPage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Inbox</h1>
        </div>
      </div>
      <SectionErrorBoundary title="inbox could not be loaded">
        <SuspenseReveal
          fallback={
            <PanelSkeleton label="Loading inbox…" rows={5} variant="inbox" />
          }
        >
          <InboxFeed />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default InboxPage;
