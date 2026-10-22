/* eslint-disable shadcn/no-restyle -- Skeletons reuse the workspace tab and input classes. */
/* eslint-disable shadcn/no-unknown-classes */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listAllClientCompanies } from "@/features/clients/clients-queries";
import { getAvatarDownloadUrl } from "@/features/files/files-queries";
import { IntakeFormsPanel } from "@/features/intake/components/intake-forms-panel";
import { listIntakeForms } from "@/features/intake/intake-queries";
import {
  getEmailSettings,
  getNotificationPreferences,
} from "@/features/notifications/notifications-queries";
import { listAllEmployees } from "@/features/people/people-queries";
import { listAllProjects } from "@/features/projects/projects-queries";
import { CalendarFeedCard } from "@/features/settings/components/calendar-feed-card";
import {
  CompanySettingsForm,
  NotificationPreferencesForm,
  PreferencesForm,
  ProfileForm,
} from "@/features/settings/components/settings-forms";
import { SettingsWorkspace } from "@/features/settings/components/settings-workspace";
import { SlaSettingsForm } from "@/features/settings/components/sla-settings-form";
import {
  getCalendarFeedStatus,
  getCompanySettings,
  getSlaSettings,
} from "@/features/settings/settings-queries";
import type { SettingsSection } from "@/features/settings/settings-section";
import { AvatarUpload } from "@/features/user/components/avatar-upload";
import { SessionList } from "@/features/user/components/session-list";
import {
  getPersonalPreferences,
  listMySessions,
} from "@/features/user/user-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const listTimeZones = () => [
  ...new Set(["UTC", "Asia/Kolkata", ...Intl.supportedValuesOf("timeZone")]),
];

const SettingsPanel = async ({
  initialSection,
}: {
  readonly initialSection: SettingsSection;
}) => {
  const [
    session,
    preferences,
    company,
    employees,
    sessions,
    notificationPrefs,
    emailSettings,
    calendarFeed,
  ] = await Promise.all([
    getPageSession(),
    getPersonalPreferences({}),
    getCompanySettings({}),
    listAllEmployees(),
    listMySessions({}),
    getNotificationPreferences({}),
    getEmailSettings({}),
    getCalendarFeedStatus({}),
  ]);
  const user = session.kind === "authenticated" ? session.user : null;
  const employee =
    user && employees.ok
      ? employees.data.find(({ id }) => id === user.id)
      : null;
  const isAdmin = user?.role === "admin";
  const [sla, avatar, intakeForms, companies, projects] = await Promise.all([
    isAdmin ? getSlaSettings({}) : Promise.resolve(null),
    user ? getAvatarDownloadUrl({ userId: user.id }) : Promise.resolve(null),
    isAdmin ? listIntakeForms({}) : Promise.resolve(null),
    isAdmin ? listAllClientCompanies() : Promise.resolve(null),
    isAdmin ? listAllProjects() : Promise.resolve(null),
  ]);
  return (
    <SettingsWorkspace
      canManageWorkspace={isAdmin}
      initialSection={initialSection}
      intake={
        intakeForms?.ok && companies?.ok && projects?.ok ? (
          <IntakeFormsPanel
            companies={companies.data.flatMap(({ active, id, name }) =>
              active ? [{ id, label: name }] : []
            )}
            forms={intakeForms.data}
            projects={projects.data.map(({ id, key, name }) => ({
              id,
              label: `${key} ${name}`,
            }))}
          />
        ) : (
          <div className="panel-b muted">Intake forms could not be loaded.</div>
        )
      }
      notificationPreferences={
        <>
          {notificationPrefs.ok ? (
            <NotificationPreferencesForm
              emailDigest={emailSettings.ok ? emailSettings.data.digest : false}
              values={notificationPrefs.data}
            />
          ) : (
            <div className="panel-b muted">
              Notification preferences could not be loaded.
            </div>
          )}
          {calendarFeed.ok ? (
            <CalendarFeedCard status={calendarFeed.data} />
          ) : (
            <div className="panel-b muted">
              The calendar feed could not be loaded.
            </div>
          )}
        </>
      }
      preferences={
        preferences.ok ? (
          <PreferencesForm values={preferences.data} />
        ) : (
          <div className="panel-b muted">Preferences could not be loaded.</div>
        )
      }
      profile={
        employee ? (
          <div className="stack">
            <div className="panel-b">
              <AvatarUpload
                initialUrl={avatar?.ok ? avatar.data : null}
                userId={employee.id}
              />
            </div>
            <ProfileForm name={employee.name} />
          </div>
        ) : (
          <div className="panel-b muted">Profile details are unavailable.</div>
        )
      }
      sla={
        sla?.ok ? (
          <SlaSettingsForm
            key={JSON.stringify(sla.data)}
            timeZones={listTimeZones()}
            values={sla.data}
          />
        ) : (
          <div className="panel-b muted">SLA settings could not be loaded.</div>
        )
      }
      sessions={
        sessions.ok ? (
          <SessionList sessions={sessions.data} />
        ) : (
          <div className="panel-b muted">Sessions could not be loaded.</div>
        )
      }
      workspace={
        company.ok ? (
          <CompanySettingsForm values={company.data} />
        ) : (
          <div className="panel-b muted">
            Workspace settings could not be loaded.
          </div>
        )
      }
    />
  );
};

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

export { SettingsPanel, SettingsPanelSkeleton };
