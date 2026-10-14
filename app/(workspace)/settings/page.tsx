/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  SettingsPanel,
  SettingsPanelSkeleton,
} from "@/features/settings/components/settings-panel";
import { parseSettingsSection } from "@/features/settings/settings-section";

export const metadata: Metadata = { title: "Settings | Metsys" };

const SettingsPage = ({ searchParams }: PageProps<"/settings">) => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Settings</h1>
        <p>Manage your account and workspace preferences.</p>
      </div>
    </div>
    <Suspense fallback={<SettingsPanelSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {searchParams.then((params) => (
        <SettingsPanel
          initialSection={parseSettingsSection(params["section"])}
        />
      ))}
    </Suspense>
  </div>
);

export default SettingsPage;
