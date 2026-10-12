/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { getCompanySettingsAction } from "@/app/actions/company-settings";
import { listEmployeesAction } from "@/app/actions/employees";
import { getNotificationPreferencesAction } from "@/app/actions/notifications";
import { getPersonalPreferencesAction } from "@/app/actions/personal-preferences";
import { listMySessionsAction } from "@/app/actions/sessions";
import { getAvatarDownloadUrlAction } from "@/app/actions/uploads";
import { AvatarUpload } from "@/components/workspace/avatar-upload";
import { SessionList } from "@/components/workspace/session-list";
import {
  CompanySettingsForm,
  NotificationPreferencesForm,
  PreferencesForm,
  ProfileForm,
} from "@/components/workspace/settings-forms";
import { SettingsWorkspace } from "@/components/workspace/settings-workspace";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Settings | Metsys" };

const SettingsPage = async ({ searchParams }: PageProps<"/settings">) => {
  await connection();
  const params = await searchParams;
  const initialSection =
    params.section === "preferences" ? "preferences" : "appearance";
  const [
    session,
    preferences,
    company,
    employees,
    sessions,
    notificationPrefs,
  ] = await Promise.all([
    getPageSession(),
    getPersonalPreferencesAction({}),
    getCompanySettingsAction({}),
    listEmployeesAction({ search: "" }),
    listMySessionsAction({}),
    getNotificationPreferencesAction({}),
  ]);
  const user = session.kind === "authenticated" ? session.user : null;
  const employee =
    user && employees.ok
      ? employees.data.find((item) => item.id === user.id)
      : null;
  const isAdmin = user?.role === "admin";
  const avatar = user
    ? await getAvatarDownloadUrlAction({ userId: user.id })
    : null;
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Settings</h1>
          <p>Manage your account and workspace preferences.</p>
        </div>
      </div>
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
            <div className="panel-b muted">
              Preferences could not be loaded.
            </div>
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
            <div className="panel-b muted">
              Profile details are unavailable.
            </div>
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
    </div>
  );
};

export default SettingsPage;
