"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";

import {
  BehaviorFields,
  ProjectField,
  StepsField,
  SummaryFields,
} from "@/features/portal/components/portal-bug-fields";
import {
  FIELD_ORDER,
  LIMITS,
  toPayload,
  validate,
} from "@/features/portal/components/portal-bug-form-model";
import type {
  Errors,
  FieldKey,
  Values,
} from "@/features/portal/components/portal-bug-form-model";
import { PortalContextDisclosure } from "@/features/portal/components/portal-context-disclosure";
import {
  EnvironmentFields,
  ImpactField,
  PageUrlField,
} from "@/features/portal/components/portal-environment-fields";
import { PortalReportAttachments } from "@/features/portal/components/portal-report-attachments";
import type { CapturedScreenshot } from "@/features/portal/components/portal-screenshot-capture";
import {
  editClientBugAction,
  submitClientBugAction,
} from "@/features/portal/portal-bug-actions";
import {
  contextServerSnapshot,
  contextSnapshot,
  parseContext,
  subscribeToContext,
} from "@/features/portal/portal-context-store";
import {
  environmentServerSnapshot,
  environmentSnapshot,
  parseEnvironment,
} from "@/features/portal/portal-environment";
import { recordFailedUploads } from "@/features/portal/portal-failed-uploads";
import { withReportExtras } from "@/features/portal/portal-report-extras";
import { uploadPortalFiles } from "@/features/portal/portal-upload";

import {
  conflictMessage,
  initialValues,
  noSubscription,
  submitLabel,
} from "./portal-bug-form-mode";
import type { Mode } from "./portal-bug-form-mode";

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
  const [captured, setCaptured] = useState<CapturedScreenshot | null>(null);
  const [sendContext, setSendContext] = useState(true);
  const context = parseContext(
    useSyncExternalStore(
      subscribeToContext,
      contextSnapshot,
      contextServerSnapshot
    )
  );
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
      ...withReportExtras(toPayload(values, detected), {
        context,
        screenshotDescription: captured?.description,
        sendContext,
      }),
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
    const toUpload = captured ? [captured.file, ...files] : files;
    const failures = await uploadPortalFiles(bugId, toUpload, (index, file) =>
      setProgress(
        `Uploading file ${index + 1} of ${toUpload.length}: ${file.name}`
      )
    );
    recordFailedUploads(bugId, failures);
    // The report is filed; Back should not return to the finished form.
    router.replace(`/portal/bugs/${bugId}`, {
      transitionTypes: ["nav-forward"],
    });
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
        responseTimes={mode.kind === "create" ? mode.responseTimes : null}
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
        <PortalReportAttachments
          captured={captured}
          disabled={pending}
          files={files}
          onCaptured={(next) => {
            keyRef.current = null;
            setCaptured(next);
          }}
          onFiles={setFiles}
        />
      ) : null}
      {isCreate && context ? (
        <PortalContextDisclosure
          context={context}
          disabled={pending}
          onToggle={(send) => {
            keyRef.current = null;
            setSendContext(send);
          }}
          sendContext={sendContext}
        />
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
