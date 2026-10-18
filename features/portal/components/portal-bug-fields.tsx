"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { Plus, Trash } from "@phosphor-icons/react";

import { LIMITS } from "@/features/portal/components/portal-bug-form-model";
import type {
  Errors,
  Step,
  Values,
} from "@/features/portal/components/portal-bug-form-model";
import type { PortalProject } from "@/src/server/portal/portal-contracts";

import { FieldError } from "./portal-field-error";
import { describedBy } from "./portal-field-support";
import type { Patch } from "./portal-field-support";

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

export { BehaviorFields, ProjectField, StepsField, SummaryFields };
