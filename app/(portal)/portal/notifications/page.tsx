/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  PortalNotifications,
  PortalNotificationsSkeleton,
} from "@/features/portal/components/portal-notifications";

export const metadata: Metadata = { title: "Notifications | Metsys" };

const Page = () => (
  <PageTransition>
    <div className="page portal-narrow">
      <SectionErrorBoundary title="Notifications couldn't load">
        <SuspenseReveal fallback={<PortalNotificationsSkeleton />}>
          <PortalNotifications />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default Page;
