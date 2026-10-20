/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  SettingsPanel,
  SettingsPanelSkeleton,
} from "@/features/settings/components/settings-panel";
import { parseSettingsSection } from "@/features/settings/settings-section";

export const metadata: Metadata = { title: "Settings | Metsys" };

const SettingsPage = ({ searchParams }: PageProps<"/settings">) => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Settings</h1>
          <p>Manage your account and workspace preferences.</p>
        </div>
      </div>
      <SectionErrorBoundary title="settings could not be loaded">
        <SuspenseReveal fallback={<SettingsPanelSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => (
            <SettingsPanel
              initialSection={parseSettingsSection(params["section"])}
            />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default SettingsPage;
