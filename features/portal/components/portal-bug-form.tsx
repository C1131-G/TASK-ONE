"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";

import {
  BehaviorFields,
  EnvironmentFields,
  ImpactField,
  PageUrlField,
  ProjectField,
  StepsField,
  SummaryFields,
} from "@/features/portal/components/portal-bug-fields";
import {
  FIELD_ORDER,
  LIMITS,
  emptyValues,
  toPayload,
  validate,
  valuesFromBug,
} from "@/features/portal/components/portal-bug-form-model";
import type {
  Errors,
  FieldKey,
  Values,
} from "@/features/portal/components/portal-bug-form-model";
import { PortalFilePicker } from "@/features/portal/components/portal-file-picker";
import {
  editClientBugAction,
  submitClientBugAction,
} from "@/features/portal/portal-actions";
import {
  environmentServerSnapshot,
  environmentSnapshot,
  parseEnvironment,
} from "@/features/portal/portal-environment";
import { recordFailedUploads } from "@/features/portal/portal-failed-uploads";
import { uploadPortalFiles } from "@/features/portal/portal-upload";
import { PORTAL_MAX_FILES_PER_BUG } from "@/features/portal/portal-upload-rules";
import type {
  PortalBugDetail,
  PortalProject,
} from "@/src/server/portal/portal-contracts";

type Mode =
  | {
      readonly kind: "create";
      readonly projects: readonly PortalProject[];
      // A closed bug being reported again; its fields prefill the form.
      readonly recurrenceOf?: PortalBugDetail;
    }
  | {
      readonly kind: "edit";
      readonly bug: PortalBugDetail;
      readonly onCancel: () => void;
      readonly onDone: () => void;
    };

const unsubscribe = () => {
  // The browser's environment does not change while the form is open.
};
const noSubscription = () => unsubscribe;

const initialValues = (mode: Mode): Values => {
  if (mode.kind === "edit") {
    return valuesFromBug(mode.bug);
  }
  const { recurrenceOf } = mode;
  if (recurrenceOf) {
    // Environment is left to the current browser; screenshots start empty.
    return {
      ...valuesFromBug(recurrenceOf),
      browser: null,
      device: null,
      os: null,
    };
  }
  return emptyValues(
    mode.projects.length === 1 ? (mode.projects[0]?.id ?? "") : ""
  );
};

const submitLabel = (mode: Mode, pending: boolean) => {
  if (mode.kind === "edit") {
    return pending ? "Saving…" : "Save changes";
  }
  return pending ? "Submitting…" : "Submit bug";
};

const conflictMessage =
  "This bug changed while you were editing. Reload the page to see the latest version, then try again.";

// The report form and the edit form share every field. Reporting also takes
// screenshots, uploaded once the bug exists.
const PortalBugForm = ({ mode }: { readonly mode: Mode }) => {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => initialValues(mode));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const stepCounter = useRef(values.steps.length);
  const keyRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isCreate = mode.kind === "create";
  const detected = parseEnvironment(
    useSyncExternalStore(
      noSubscription,
      environmentSnapshot,
      environmentServerSnapshot
    )
  );

  // Changing anything starts a new attempt, so an old idempotency key is never
  // reused with different input.
  const patch = (changes: Partial<Values>) => {
    keyRef.current = null;
    setValues((current) => ({ ...current, ...changes }));
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !(key in changes))
      )
    );
  };

  const changeStep = (id: string, text: string) => {
    keyRef.current = null;
    setValues((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === id ? { ...step, text } : step
      ),
    }));
    setErrors(({ steps: _steps, ...rest }) => rest);
  };

  const addStep = () => {
    if (values.steps.length >= LIMITS.steps) {
      return;
    }
    const id = `step-${stepCounter.current}`;
    stepCounter.current += 1;
    patch({ steps: [...values.steps, { id, text: "" }] });
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLInputElement>(`[data-step-id="${id}"]`)
        ?.focus();
    });
  };

  const removeStep = (id: string) => {
    if (values.steps.length > 1) {
      patch({ steps: values.steps.filter((step) => step.id !== id) });
    }
  };

  const focusFirstError = (found: Errors) => {
    const first = FIELD_ORDER.find((key: FieldKey) => found[key]);
    if (first) {
      formRef.current
        ?.querySelector<HTMLElement>(`[data-field="${first}"]`)
        ?.focus();
    }
  };

  const createBug = async (idempotencyKey: string) => {
    const result = await submitClientBugAction({
      ...toPayload(values, detected),
      idempotencyKey,
      projectId: values.projectId,
      ...(mode.kind === "create" && mode.recurrenceOf
        ? { recurrenceOfBugId: mode.recurrenceOf.id }
        : {}),
    });
    if (!result.ok) {
      setFormError(result.error.message);
      setPending(false);
      return;
    }
    const { bugId } = result.data;
    const failures = await uploadPortalFiles(bugId, files, (index, file) =>
      setProgress(
        `Uploading file ${index + 1} of ${files.length}: ${file.name}`
      )
    );
    recordFailedUploads(bugId, failures);
    router.push(`/portal/bugs/${bugId}`);
  };

  const editBug = async (idempotencyKey: string) => {
    if (mode.kind !== "edit") {
      return;
    }
    const result = await editClientBugAction({
      ...toPayload(values, detected),
      bugId: mode.bug.id,
      expectedVersion: mode.bug.version,
      idempotencyKey,
    });
    if (!result.ok) {
      setFormError(
        result.error.code === "CONFLICT"
          ? conflictMessage
          : result.error.message
      );
      setPending(false);
      return;
    }
    router.refresh();
    mode.onDone();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const found = validate(values, isCreate);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }
    setPending(true);
    if (!keyRef.current) {
      keyRef.current = crypto.randomUUID();
    }
    try {
      await (isCreate ? createBug(keyRef.current) : editBug(keyRef.current));
    } catch {
      setFormError(
        "Something went wrong. Check your connection and try again."
      );
      setPending(false);
    }
  };

  const handleCancel = () => {
    if (mode.kind === "edit") {
      mode.onCancel();
    }
  };

  return (
    <form
      aria-busy={pending}
      className="portal-form"
      noValidate
      onSubmit={submit}
      ref={formRef}
    >
      {mode.kind === "create" ? (
        <ProjectField
          errors={errors}
          onPatch={patch}
          pending={pending}
          projects={mode.projects}
          value={values.projectId}
        />
      ) : null}
      <SummaryFields
        errors={errors}
        onPatch={patch}
        pending={pending}
        values={values}
      />
      <StepsField
        errors={errors}
        onAdd={addStep}
        onRemove={removeStep}
        onStepChange={changeStep}
        pending={pending}
        steps={values.steps}
      />
      <BehaviorFields
        errors={errors}
        onPatch={patch}
        pending={pending}
        values={values}
      />
      <PageUrlField
        errors={errors}
        onPatch={patch}
        pending={pending}
        value={values.pageUrl}
      />
      <ImpactField
        errors={errors}
        onPatch={patch}
        pending={pending}
        value={values.impact}
      />
      <EnvironmentFields
        detected={detected}
        isCreate={isCreate}
        onPatch={patch}
        pending={pending}
        values={values}
      />
      {isCreate ? (
        <div className="field">
          <span className="label">
            Screenshots <span className="faint">(optional)</span>
          </span>
          <PortalFilePicker
            disabled={pending}
            files={files}
            onChange={setFiles}
            slots={PORTAL_MAX_FILES_PER_BUG}
          />
        </div>
      ) : null}
      {formError ? (
        <p className="portal-form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <output aria-live="polite" className="muted">
        {progress}
      </output>
      <div className="portal-form-acts">
        <button className="btn btn-primary" disabled={pending} type="submit">
          {submitLabel(mode, pending)}
        </button>
        {mode.kind === "edit" ? (
          <button
            className="btn btn-ghost"
            disabled={pending}
            onClick={handleCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
};

export { PortalBugForm };
