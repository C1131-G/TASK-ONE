/* eslint-disable shadcn/no-restyle */
/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the settings workspace markup. */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const THEMES = [
  {
    description: "Use your device appearance setting.",
    id: "system",
    label: "System",
  },
  { description: "Use a light workspace.", id: "light", label: "Light" },
  { description: "Use a dark workspace.", id: "dark", label: "Dark" },
] as const;

// Mirrors SettingsWorkspace's Appearance tab: it needs no data, so the first
// section is the real static markup, not placeholder bones.
const SettingsPanelSkeleton = () => (
  <Tabs className="settings-workspace" value="appearance">
    <TabsList aria-label="Settings sections" className="settings-nav" inert>
      <TabsTrigger value="appearance">Appearance</TabsTrigger>
      <TabsTrigger value="profile">Profile</TabsTrigger>
      <TabsTrigger value="preferences">Preferences</TabsTrigger>
      <TabsTrigger value="sessions">Sessions</TabsTrigger>
    </TabsList>
    <output className="sr-only">Loading settings…</output>
    <div className="settings-content">
      <section className="panel">
        <div className="panel-h">
          <h2>Appearance</h2>
          <p>Customize how Metsys looks on this device.</p>
        </div>
        <div className="panel-b stack">
          <div>
            <h3 className="settings-section-title">Theme</h3>
            <p className="muted">
              Choose a theme or follow your device setting.
            </p>
          </div>
          <div className="settings-theme-options skeleton-theme-options">
            {THEMES.map(({ description, id, label }) => (
              <div className="settings-theme-choice" key={id}>
                <span
                  aria-hidden="true"
                  className="settings-theme-preview"
                  data-theme-preview={id}
                >
                  <span className="settings-preview-sidebar" />
                  <span className="settings-preview-main">
                    <i />
                    <i />
                    <i />
                    <b />
                  </span>
                </span>
                <span className="settings-theme-choice-caption">
                  <span aria-hidden="true" className="skeleton-radio" />
                  <span>
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  </Tabs>
);

export { SettingsPanelSkeleton };
