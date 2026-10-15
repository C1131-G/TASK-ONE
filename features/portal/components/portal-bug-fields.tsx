"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { Plus, Trash } from "@phosphor-icons/react";

import { LIMITS } from "@/features/portal/components/portal-bug-form-model";
import type {
  Errors,
  FieldKey,
  Step,
  Values,
} from "@/features/portal/components/portal-bug-form-model";
import type { DetectedEnvironment } from "@/features/portal/portal-environment";
import {
  impactHint,
  impactText,
  portalImpacts,
} from "@/features/portal/portal-format";
import { usuallyRespondText } from "@/features/portal/portal-response-time";
import type {
  PortalResponseTimes,
  PortalProject,
} from "@/src/server/portal/portal-contracts";

type Patch = (patch: Partial<Values>) => void;

const errorId = (key: FieldKey) => `portal-err-${key}`;

const describedBy = (errors: Errors, key: FieldKey, hintId?: string) =>
  [hintId, errors[key] ? errorId(key) : undefined].filter(Boolean).join(" ") ||
  undefined;

const FieldError = ({
  errors,
  field,
}: {
  readonly errors: Errors;
  readonly field: FieldKey;
}) =>
  errors[field] ? (
    <p className="err" id={errorId(field)} role="alert">
      {errors[field]}
    </p>
  ) : null;

const ProjectField = ({
  errors,
  onPatch,
  pending,
  projects,
  value,
}: {
  readonly errors: Errors;
  readonly onPatch: Patch;
  readonly pending: boolean;
  readonly projects: readonly PortalProject[];
  readonly value: string;
}) => (
  <div className="field">
    <label className="label" htmlFor="portal-project">
      Project
    </label>
    <select
      aria-describedby={describedBy(errors, "projectId")}
      aria-invalid={errors.projectId ? true : undefined}
      className="select"
      data-field="projectId"
      disabled={pending}
      id="portal-project"
      onChange={(event) => onPatch({ projectId: event.target.value })}
      required
      value={value}
    >
      <option value="">Choose a project</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
    <FieldError errors={errors} field="projectId" />
  </div>
);

const SummaryFields = ({
  errors,
  onPatch,
  pending,
  values,
}: {
  readonly errors: Errors;
  readonly onPatch: Patch;
  readonly pending: boolean;
  readonly values: Values;
}) => (
  <>
    <div className="field">
      <label className="label" htmlFor="portal-title">
        Title
      </label>
      <input
        aria-describedby={describedBy(errors, "title", "portal-title-hint")}
        aria-invalid={errors.title ? true : undefined}
        className="input"
        data-field="title"
        disabled={pending}
        id="portal-title"
        maxLength={LIMITS.title}
        onChange={(event) => onPatch({ title: event.target.value })}
        placeholder="Short summary, e.g. “Invoice export fails”"
        required
        value={values.title}
      />
      <p className="hint" id="portal-title-hint">
        A one-line summary of the problem.
      </p>
      <FieldError errors={errors} field="title" />
    </div>
    <div className="field">
      <label className="label" htmlFor="portal-description">
        Description <span className="faint">(optional)</span>
      </label>
      <textarea
        className="textarea"
        disabled={pending}
        id="portal-description"
        maxLength={LIMITS.text}
        onChange={(event) => onPatch({ description: event.target.value })}
        rows={4}
        value={values.description}
      />
    </div>
  </>
);

const StepsField = ({
  errors,
  onAdd,
  onRemove,
  onStepChange,
  pending,
  steps,
}: {
  readonly errors: Errors;
  readonly onAdd: () => void;
  readonly onRemove: (id: string) => void;
  readonly onStepChange: (id: string, text: string) => void;
  readonly pending: boolean;
  readonly steps: readonly Step[];
}) => (
  <fieldset className="portal-fieldset" disabled={pending}>
    <legend className="label">Steps to reproduce</legend>
    <ol className="portal-steps">
      {steps.map((step, index) => (
        <li key={step.id}>
          <input
            aria-describedby={describedBy(errors, "steps", "portal-steps-hint")}
            aria-invalid={errors.steps ? true : undefined}
            aria-label={`Step ${index + 1}`}
            className="input"
            data-field={index === 0 ? "steps" : undefined}
            data-step-id={step.id}
            maxLength={LIMITS.text}
            onChange={(event) => onStepChange(step.id, event.target.value)}
            placeholder={index === 0 ? "e.g. Open the Invoices page" : ""}
            value={step.text}
          />
          <button
            aria-label={`Remove step ${index + 1}`}
            className="btn btn-ghost btn-sm"
            disabled={steps.length <= 1}
            onClick={() => onRemove(step.id)}
            type="button"
          >
            <Trash aria-hidden="true" size={14} />
          </button>
        </li>
      ))}
    </ol>
    <p className="hint" id="portal-steps-hint">
      One action per step, in the order you did them.
    </p>
    <FieldError errors={errors} field="steps" />
    <div>
      <button
        className="btn btn-secondary btn-sm"
        disabled={steps.length >= LIMITS.steps}
        onClick={onAdd}
        type="button"
      >
        <Plus aria-hidden="true" size={14} />
        Add step
      </button>
    </div>
  </fieldset>
);

const BehaviorFields = ({
  errors,
  onPatch,
  pending,
  values,
}: {
  readonly errors: Errors;
  readonly onPatch: Patch;
  readonly pending: boolean;
  readonly values: Values;
}) => (
  <div className="portal-two">
    <div className="field">
      <label className="label" htmlFor="portal-expected">
        Expected behavior
      </label>
      <textarea
        aria-describedby={describedBy(errors, "expected")}
        aria-invalid={errors.expected ? true : undefined}
        className="textarea"
        data-field="expected"
        disabled={pending}
        id="portal-expected"
        maxLength={LIMITS.text}
        onChange={(event) => onPatch({ expected: event.target.value })}
        required
        rows={3}
        value={values.expected}
      />
      <FieldError errors={errors} field="expected" />
    </div>
    <div className="field">
      <label className="label" htmlFor="portal-actual">
        Actual behavior
      </label>
      <textarea
        aria-describedby={describedBy(errors, "actual")}
        aria-invalid={errors.actual ? true : undefined}
        className="textarea"
        data-field="actual"
        disabled={pending}
        id="portal-actual"
        maxLength={LIMITS.text}
        onChange={(event) => onPatch({ actual: event.target.value })}
        required
        rows={3}
        value={values.actual}
      />
      <FieldError errors={errors} field="actual" />
    </div>
  </div>
);

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

export {
  BehaviorFields,
  EnvironmentFields,
  ImpactField,
  PageUrlField,
  ProjectField,
  StepsField,
  SummaryFields,
};
