/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { updateCompanySettingsAction } from "@/app/actions/company-settings";
import { updateOwnProfileAction } from "@/app/actions/employees";
import { savePersonalPreferencesAction } from "@/app/actions/personal-preferences";
import { Checkbox } from "@/components/ui/checkbox";
import { useSaveState } from "@/components/workspace/use-settings-save";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import type { CompanySettingsValues } from "@/src/server/company/company-settings";
import type { PersonalPreferenceValues } from "@/src/server/preferences/personal-preferences";

export { NotificationPreferencesForm } from "@/components/workspace/notification-preferences-form";

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
      <label className="field" htmlFor="metsys-settings-forms-field-46">
        <span>Display name</span>
        <WorkspaceInput
          autoComplete="name"
          className="input"
          defaultValue={name}
          maxLength={120}
          name="name"
          required
          id="metsys-settings-forms-field-46"
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
        <label className="field" htmlFor="metsys-settings-forms-field-105">
          <span>Density</span>
          <WorkspaceSelect
            className="input"
            defaultValue={values.density ?? "comfortable"}
            name="density"
            id="metsys-settings-forms-field-105"
          >
            <WorkspaceSelectItem value="comfortable">
              Comfortable
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="compact">Compact</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <label className="field" htmlFor="metsys-settings-forms-field-118">
          <span>Calendar view</span>
          <WorkspaceSelect
            className="input"
            defaultValue={values.calendarView ?? "week"}
            name="calendarView"
            id="metsys-settings-forms-field-118"
          >
            <WorkspaceSelectItem value="day">Day</WorkspaceSelectItem>
            <WorkspaceSelectItem value="week">Week</WorkspaceSelectItem>
            <WorkspaceSelectItem value="month">Month</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
      </div>
      <label className="field" htmlFor="metsys-settings-forms-field-131">
        <span>Time zone</span>
        <WorkspaceSelect
          className="input"
          defaultValue={values.timezone ?? "Asia/Kolkata"}
          name="timezone"
          id="metsys-settings-forms-field-131"
        >
          <WorkspaceSelectItem value="Asia/Kolkata">
            India Standard Time
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="UTC">UTC</WorkspaceSelectItem>
          <WorkspaceSelectItem value="America/New_York">
            Eastern Time
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="Europe/London">
            United Kingdom
          </WorkspaceSelectItem>
        </WorkspaceSelect>
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
      <label className="field" htmlFor="metsys-settings-forms-field-191">
        <span>Company name</span>
        <WorkspaceInput
          className="input"
          defaultValue={values.name}
          maxLength={100}
          name="name"
          required
          id="metsys-settings-forms-field-191"
        />
      </label>
      <div className="row">
        <label className="field" htmlFor="metsys-settings-forms-field-202">
          <span>Company slug</span>
          <WorkspaceInput
            className="input"
            defaultValue={values.slug}
            maxLength={80}
            name="slug"
            required
            id="metsys-settings-forms-field-202"
          />
        </label>
        <label className="field" htmlFor="metsys-settings-forms-field-212">
          <span>Time zone</span>
          <WorkspaceSelect
            className="input"
            defaultValue={values.timeZone}
            name="timeZone"
            id="metsys-settings-forms-field-212"
          >
            <WorkspaceSelectItem value="Asia/Kolkata">
              India Standard Time
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="UTC">UTC</WorkspaceSelectItem>
            <WorkspaceSelectItem value="America/New_York">
              Eastern Time
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="Europe/London">
              United Kingdom
            </WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
      </div>
      <div className="row">
        <label className="field" htmlFor="metsys-settings-forms-field-233">
          <span>Brand color</span>
          <WorkspaceInput
            className="input"
            defaultValue={values.brandColor}
            name="brandColor"
            type="color"
            id="metsys-settings-forms-field-233"
          />
        </label>
        <label className="row" htmlFor="metsys-settings-forms-field-242">
          <Checkbox
            defaultChecked={values.brandEnabled}
            name="brandEnabled"
            id="metsys-settings-forms-field-242"
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
