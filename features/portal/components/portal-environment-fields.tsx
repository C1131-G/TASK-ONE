"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { LIMITS } from "@/features/portal/components/portal-bug-form-model";
import type {
  Errors,
  Values,
} from "@/features/portal/components/portal-bug-form-model";
import type { DetectedEnvironment } from "@/features/portal/portal-environment";
import {
  impactHint,
  impactText,
  portalImpacts,
} from "@/features/portal/portal-format";
import { usuallyRespondText } from "@/features/portal/portal-response-time";
import type { PortalResponseTimes } from "@/src/server/portal/portal-contracts";

import { FieldError } from "./portal-field-error";
import { describedBy } from "./portal-field-support";
import type { Patch } from "./portal-field-support";

const PageUrlField = ({
  errors,
  onPatch,
  pending,
  value,
}: {
  readonly errors: Errors;
  readonly onPatch: Patch;
  readonly pending: boolean;
  readonly value: string;
}) => (
  <div className="field">
    <label className="label" htmlFor="portal-page-url">
      Page URL
    </label>
    <input
      aria-describedby={describedBy(errors, "pageUrl", "portal-url-hint")}
      aria-invalid={errors.pageUrl ? true : undefined}
      autoComplete="off"
      className="input"
      data-field="pageUrl"
      disabled={pending}
      id="portal-page-url"
      inputMode="url"
      maxLength={LIMITS.url}
      onChange={(event) => onPatch({ pageUrl: event.target.value })}
      placeholder="https://"
      required
      value={value}
    />
    <p className="hint" id="portal-url-hint">
      Copy the address from your browser where the problem happened.
    </p>
    <FieldError errors={errors} field="pageUrl" />
  </div>
);

const ImpactField = ({
  errors,
  onPatch,
  pending,
  responseTimes,
  value,
}: {
  readonly errors: Errors;
  readonly onPatch: Patch;
  readonly pending: boolean;
  readonly responseTimes?: PortalResponseTimes | null | undefined;
  readonly value: Values["impact"];
}) => (
  <fieldset
    aria-describedby={describedBy(errors, "impact")}
    className="portal-fieldset"
    disabled={pending}
  >
    <legend className="label">Impact</legend>
    <div className="portal-impacts">
      {portalImpacts.map((impact, index) => (
        // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- The radio sits inside its label, which also holds the option's text.
        <label
          className="portal-impact"
          data-checked={value === impact || undefined}
          htmlFor={`portal-impact-${impact}`}
          key={impact}
        >
          <input
            checked={value === impact}
            data-field={index === 0 ? "impact" : undefined}
            id={`portal-impact-${impact}`}
            name="impact"
            onChange={() => onPatch({ impact })}
            type="radio"
            value={impact}
          />
          <span>
            <strong>{impactText[impact]}</strong>
            <span className="faint">{impactHint[impact]}</span>
          </span>
        </label>
      ))}
    </div>
    {responseTimes && value ? (
      <output className="portal-response-note">
        {usuallyRespondText(
          responseTimes.firstResponseMinutes[value],
          responseTimes
        )}
      </output>
    ) : null}
    <FieldError errors={errors} field="impact" />
  </fieldset>
);

const ENVIRONMENT_FIELDS = [
  ["browser", "Browser", "portal-browser"],
  ["device", "Device", "portal-device"],
  ["os", "Operating system", "portal-os"],
] as const;

const EnvironmentFields = ({
  detected,
  isCreate,
  onPatch,
  pending,
  values,
}: {
  readonly detected: DetectedEnvironment;
  readonly isCreate: boolean;
  readonly onPatch: Patch;
  readonly pending: boolean;
  readonly values: Values;
}) => (
  <fieldset className="portal-fieldset" disabled={pending}>
    <legend className="label">Your environment</legend>
    <p className="hint">
      {isCreate
        ? "Detected from your browser. Correct anything that looks wrong."
        : "Correct anything that looks wrong."}
    </p>
    <div className="portal-three">
      {ENVIRONMENT_FIELDS.map(([key, label, id]) => (
        <div className="field" key={key}>
          <label className="label" htmlFor={id}>
            {label}
          </label>
          <input
            className="input"
            id={id}
            maxLength={LIMITS.short}
            onChange={(event) => onPatch({ [key]: event.target.value })}
            value={values[key] ?? detected[key]}
          />
        </div>
      ))}
    </div>
  </fieldset>
);

export { EnvironmentFields, ImpactField, PageUrlField };
