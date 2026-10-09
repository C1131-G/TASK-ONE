/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateCompanySettingsAction } from "@/app/actions/company-settings";
import { updateOwnProfileAction } from "@/app/actions/employees";
import { savePersonalPreferencesAction } from "@/app/actions/personal-preferences";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import type { CompanySettingsValues } from "@/src/server/company/company-settings";
import type { PersonalPreferenceValues } from "@/src/server/preferences/personal-preferences";

const useSaveState = () => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return { error, pending, router, setError, startTransition };
};

const ProfileForm = ({ name }: { readonly name: string }) => {
  const { error, pending, router, setError, startTransition } = useSaveState();
  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateOwnProfileAction({
        idempotencyKey: crypto.randomUUID(),
        name: String(formData.get("name") ?? "").trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });
  return (
    <form action={save} className="panel panel-b stack">
      <label className="field">
        <span>Display name</span>
        <WorkspaceInput
          autoComplete="name"
          className="input"
          defaultValue={name}
          maxLength={120}
          name="name"
          required
        />
      </label>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <WorkspaceButton
        className="btn btn-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save profile"}
      </WorkspaceButton>
    </form>
  );
};

const PreferencesForm = ({
  values,
}: {
  readonly values: PersonalPreferenceValues;
}) => {
  const { error, pending, router, setError, startTransition } = useSaveState();
  const save = (formData: FormData) =>
    startTransition(async () => {
      const density = String(formData.get("density"));
      const calendarView = String(formData.get("calendarView"));
      const timezone = String(formData.get("timezone"));
      const result = await savePersonalPreferencesAction({
        idempotencyKey: crypto.randomUUID(),
        preferences: {
          ...(values.defaultViewId === undefined
            ? {}
            : { defaultViewId: values.defaultViewId }),
          calendarView,
          density,
          timezone,
        },
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });
  return (
    <form action={save} className="panel panel-b stack">
      <div className="row">
        <label className="field">
          <span>Density</span>
          <select
            className="input"
            defaultValue={values.density ?? "comfortable"}
            name="density"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label className="field">
          <span>Calendar view</span>
          <select
            className="input"
            defaultValue={values.calendarView ?? "week"}
            name="calendarView"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Time zone</span>
        <select
          className="input"
          defaultValue={values.timezone ?? "Asia/Kolkata"}
          name="timezone"
        >
          <option value="Asia/Kolkata">India Standard Time</option>
          <option value="UTC">UTC</option>
          <option value="America/New_York">Eastern Time</option>
          <option value="Europe/London">United Kingdom</option>
        </select>
      </label>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <WorkspaceButton
        className="btn btn-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save preferences"}
      </WorkspaceButton>
    </form>
  );
};

const CompanySettingsForm = ({
  values,
}: {
  readonly values: CompanySettingsValues;
}) => {
  const { error, pending, router, setError, startTransition } = useSaveState();
  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateCompanySettingsAction({
        brandColor: String(formData.get("brandColor")),
        brandEnabled: formData.get("brandEnabled") === "on",
        idempotencyKey: crypto.randomUUID(),
        name: String(formData.get("name") ?? "").trim(),
        slug: String(formData.get("slug") ?? "").trim(),
        timeZone: String(formData.get("timeZone")),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });
  return (
    <form action={save} className="panel panel-b stack">
      <label className="field">
        <span>Company name</span>
        <WorkspaceInput
          className="input"
          defaultValue={values.name}
          maxLength={100}
          name="name"
          required
        />
      </label>
      <div className="row">
        <label className="field">
          <span>Company slug</span>
          <WorkspaceInput
            className="input"
            defaultValue={values.slug}
            maxLength={80}
            name="slug"
            required
          />
        </label>
        <label className="field">
          <span>Time zone</span>
          <select
            className="input"
            defaultValue={values.timeZone}
            name="timeZone"
          >
            <option value="Asia/Kolkata">India Standard Time</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="Europe/London">United Kingdom</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label className="field">
          <span>Brand color</span>
          <WorkspaceInput
            className="input"
            defaultValue={values.brandColor}
            name="brandColor"
            type="color"
          />
        </label>
        <label className="row">
          <input
            defaultChecked={values.brandEnabled}
            name="brandEnabled"
            type="checkbox"
          />
          <span>Enable company branding</span>
        </label>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <WorkspaceButton
        className="btn btn-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save company settings"}
      </WorkspaceButton>
    </form>
  );
};

export { CompanySettingsForm, PreferencesForm, ProfileForm };
