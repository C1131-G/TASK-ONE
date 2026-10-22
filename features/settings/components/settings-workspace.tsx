/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHydrated } from "@/components/workspace/use-hydrated";
import type { SettingsSection } from "@/features/settings/settings-section";

const changeSection = (value: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set("section", value);
  window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
};

const resolveSection = (
  requestedSection: string | null,
  canManageWorkspace: boolean,
  initialSection: SettingsSection
): SettingsSection => {
  if (
    requestedSection === "workspace" ||
    requestedSection === "sla" ||
    requestedSection === "intake"
  ) {
    return canManageWorkspace ? requestedSection : "appearance";
  }
  if (
    requestedSection === "profile" ||
    requestedSection === "preferences" ||
    requestedSection === "sessions"
  ) {
    return requestedSection;
  }
  return initialSection;
};

const ThemeChoice = ({
  description,
  id,
  label,
}: {
  readonly description: string;
  readonly id: string;
  readonly label: string;
}) => (
  <label className="settings-theme-choice" htmlFor={id}>
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
      <RadioGroupItem id={id} value={id} />
      <span>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
    </span>
  </label>
);

const SettingsWorkspace = ({
  canManageWorkspace,
  initialSection,
  intake,
  notificationPreferences,
  preferences,
  profile,
  sessions,
  sla,
  workspace,
}: {
  readonly canManageWorkspace: boolean;
  readonly initialSection: SettingsSection;
  readonly intake: ReactNode;
  readonly notificationPreferences: ReactNode;
  readonly preferences: ReactNode;
  readonly profile: ReactNode;
  readonly sessions: ReactNode;
  readonly sla: ReactNode;
  readonly workspace: ReactNode;
}) => {
  const { setTheme, theme } = useTheme();
  const themeHydrated = useHydrated();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const section = resolveSection(
    requestedSection,
    canManageWorkspace,
    initialSection
  );

  return (
    <Tabs
      className="settings-workspace"
      data-workspace-settings="true"
      onValueChange={changeSection}
      orientation="horizontal"
      value={section}
    >
      <TabsList aria-label="Settings sections" className="settings-nav">
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
        {canManageWorkspace ? (
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        ) : null}
        {canManageWorkspace ? (
          <TabsTrigger value="sla">SLA &amp; business hours</TabsTrigger>
        ) : null}
        {canManageWorkspace ? (
          <TabsTrigger value="intake">Intake forms</TabsTrigger>
        ) : null}
      </TabsList>
      <div className="settings-content">
        <TabsContent value="appearance">
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
              <RadioGroup
                aria-label="Theme"
                className="settings-theme-options"
                onValueChange={setTheme}
                value={themeHydrated ? (theme ?? "system") : "system"}
              >
                <ThemeChoice
                  description="Use your device appearance setting."
                  id="system"
                  label="System"
                />
                <ThemeChoice
                  description="Use a light workspace."
                  id="light"
                  label="Light"
                />
                <ThemeChoice
                  description="Use a dark workspace."
                  id="dark"
                  label="Dark"
                />
              </RadioGroup>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="profile">
          <section className="panel">
            <div className="panel-h">
              <h2>Profile</h2>
              <p>Update the name and profile photo shown to your team.</p>
            </div>
            {profile}
            <div className="panel-b settings-password-link">
              <Link className="btn btn-secondary" href="/change-password">
                Change password
              </Link>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="preferences">
          <section className="panel">
            <div className="panel-h">
              <h2>Preferences</h2>
              <p>Choose how dates and task lists are shown for your account.</p>
            </div>
            {preferences}
          </section>
          {notificationPreferences}
        </TabsContent>
        <TabsContent value="sessions">
          <section className="panel">
            <div className="panel-h">
              <h2>Active sessions</h2>
              <p>Review and revoke sessions for this account.</p>
            </div>
            {sessions}
          </section>
        </TabsContent>
        {canManageWorkspace ? (
          <TabsContent value="workspace">
            <section className="panel">
              <div className="panel-h">
                <h2>Workspace</h2>
                <p>Manage company identity and default time zone.</p>
              </div>
              {workspace}
              <div className="panel-b">
                <Link className="btn btn-secondary" href="/settings/webhooks">
                  Webhooks and Slack
                </Link>{" "}
                <Link className="btn btn-secondary" href="/settings/github">
                  GitHub
                </Link>
              </div>
            </section>
          </TabsContent>
        ) : null}
        {canManageWorkspace ? (
          <TabsContent value="sla">
            <section className="panel">
              <div className="panel-h">
                <h2>SLA &amp; business hours</h2>
                <p>Set response and resolution targets for client bugs.</p>
              </div>
              {sla}
            </section>
          </TabsContent>
        ) : null}
        {canManageWorkspace ? (
          <TabsContent value="intake">
            <section className="panel">
              <div className="panel-h">
                <h2>Intake forms</h2>
                <p>
                  Let people outside the portal report bugs through a public
                  link.
                </p>
              </div>
              {intake}
            </section>
          </TabsContent>
        ) : null}
      </div>
    </Tabs>
  );
};

export { SettingsWorkspace };
