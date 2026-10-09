/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { getCompanySettingsAction } from "@/app/actions/company-settings";
import { listEmployeesAction } from "@/app/actions/employees";
import { getPersonalPreferencesAction } from "@/app/actions/personal-preferences";
import { listMySessionsAction } from "@/app/actions/sessions";
import { getAvatarDownloadUrlAction } from "@/app/actions/uploads";
import { AvatarUpload } from "@/components/workspace/avatar-upload";
import { SessionList } from "@/components/workspace/session-list";
import {
  CompanySettingsForm,
  PreferencesForm,
  ProfileForm,
} from "@/components/workspace/settings-forms";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Settings | Metsys" };

const SettingsPage = async () => {
  await connection();
  const [session, preferences, company, employees, sessions] =
    await Promise.all([
      getPageSession(),
      getPersonalPreferencesAction({}),
      getCompanySettingsAction({}),
      listEmployeesAction({ search: "" }),
      listMySessionsAction({}),
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
      <div className="stack">
        <section className="panel">
          <div className="panel-h">
            <h2>Profile</h2>
          </div>
          {employee ? (
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
          )}
        </section>
        {sessions.ok ? <SessionList sessions={sessions.data} /> : null}
        <section className="panel">
          <div className="panel-h">
            <h2>Personal preferences</h2>
          </div>
          {preferences.ok ? (
            <PreferencesForm values={preferences.data} />
          ) : (
            <div className="panel-b muted">
              Preferences could not be loaded.
            </div>
          )}
        </section>
        {isAdmin ? (
          <section className="panel">
            <div className="panel-h">
              <h2>Company settings</h2>
            </div>
            {company.ok ? (
              <CompanySettingsForm values={company.data} />
            ) : (
              <div className="panel-b muted">
                Company settings could not be loaded.
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default SettingsPage;
