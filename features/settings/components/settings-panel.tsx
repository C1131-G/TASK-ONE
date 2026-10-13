/* eslint-disable shadcn/no-unknown-classes */

import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { getCompanySettings } from "@/features/company/company-queries";
import { getAvatarDownloadUrl } from "@/features/files/files-queries";
import { getNotificationPreferences } from "@/features/notifications/notifications-queries";
import { listEmployees } from "@/features/people/people-queries";
import {
  CompanySettingsForm,
  NotificationPreferencesForm,
  PreferencesForm,
  ProfileForm,
} from "@/features/settings/components/settings-forms";
import { SettingsWorkspace } from "@/features/settings/components/settings-workspace";
import type { SettingsSection } from "@/features/settings/settings-section";
import { AvatarUpload } from "@/features/user/components/avatar-upload";
import { SessionList } from "@/features/user/components/session-list";
import {
  getPersonalPreferences,
  listMySessions,
} from "@/features/user/user-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const SettingsPanel = async ({
  initialSection,
}: {
  readonly initialSection: SettingsSection;
}) => {
  await connection();
  const [
    session,
    preferences,
    company,
    employees,
    sessions,
    notificationPrefs,
  ] = await Promise.all([
    getPageSession(),
    getPersonalPreferences({}),
    getCompanySettings({}),
    listEmployees({ search: "" }),
    listMySessions({}),
    getNotificationPreferences({}),
  ]);
  const user = session.kind === "authenticated" ? session.user : null;
  const employee =
    user && employees.ok
      ? employees.data.find((item) => item.id === user.id)
      : null;
  const isAdmin = user?.role === "admin";
  const avatar = user ? await getAvatarDownloadUrl({ userId: user.id }) : null;
  return (
    <SettingsWorkspace
      canManageWorkspace={isAdmin}
      initialSection={initialSection}
      notificationPreferences={
        notificationPrefs.ok ? (
          <NotificationPreferencesForm values={notificationPrefs.data} />
        ) : (
          <div className="panel-b muted">
            Notification preferences could not be loaded.
          </div>
        )
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

const SettingsPanelSkeleton = () => (
  <PanelSkeleton label="Loading settings…" rows={6} />
);

export { SettingsPanel, SettingsPanelSkeleton };
