/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  WebhooksPanel,
  WebhooksPanelSkeleton,
} from "@/features/webhooks/components/webhooks-panel";

export const metadata: Metadata = { title: "Webhooks | Metsys" };

const WebhooksPage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Webhooks</h1>
          <p>
            Send task, comment, bug and project events to your own systems or to
            Slack.
          </p>
        </div>
      </div>
      <SectionErrorBoundary title="Webhooks couldn't load">
        <SuspenseReveal fallback={<WebhooksPanelSkeleton />}>
          <WebhooksPanel />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default WebhooksPage;
