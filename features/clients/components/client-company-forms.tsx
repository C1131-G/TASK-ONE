/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import {
  createClientCompanyAction,
  deactivateClientCompanyAction,
  reactivateClientCompanyAction,
  updateClientCompanyAction,
} from "@/features/clients/clients-actions";

interface CompanyRef {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

// Company mutations answer with the company's new version; the caller keeps it
// so the next mutation does not race the page refresh.
type VersionSink = (version: number) => void;

const COMPANY_NAME_MAX = 160;
const COMPANY_FIELDS = ["name"] as const;

const ClientCompanyCreateForm = () => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { clearErrors, errors, fieldProps, formId, formRef, showFailure } =
    useFormErrors(COMPANY_FIELDS);
  const create = (formData: FormData) =>
    startTransition(async () => {
      const result = await createClientCompanyAction({
        idempotencyKey: crypto.randomUUID(),
        name: String(formData.get("name") ?? "").trim(),
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      clearErrors();
      router.push(`/clients/${result.data.companyId}`, {
        transitionTypes: ["nav-forward"],
      });
    });
  return (
    <WorkspaceDisclosure
      description="Create a client company, then add its users, projects and handlers."
      title="New company"
      trigger={
        <WorkspaceButton className="btn btn-primary btn-sm" type="button">
          New company
        </WorkspaceButton>
      }
    >
      <form
        aria-busy={pending || undefined}
        className="panel-b stack clients-dialog-body"
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          create(new FormData(event.currentTarget));
        }}
      >
        <div className="field">
          <label htmlFor={`${formId}-name`}>Company name</label>
          <WorkspaceInput
            autoComplete="organization"
            className="input"
            id={`${formId}-name`}
            maxLength={COMPANY_NAME_MAX}
            name="name"
            required
            {...fieldProps("name")}
          />
          <WorkspaceFieldError errors={errors} field="name" formId={formId} />
        </div>
        <WorkspaceFormError errors={errors} />
        <div className="acts">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? "Creating…" : "Create company"}
          </WorkspaceButton>
        </div>
      </form>
    </WorkspaceDisclosure>
  );
};

const ClientCompanyRenameForm = ({
  company,
  onVersion,
  version,
}: {
  readonly company: CompanyRef;
  readonly onVersion: VersionSink;
  readonly version: number;
}) => {
  const [pending, startTransition] = useTransition();
  const { clearErrors, errors, fieldProps, formId, formRef, showFailure } =
    useFormErrors(COMPANY_FIELDS);
  const rename = (formData: FormData, close: () => void) =>
    startTransition(async () => {
      const result = await updateClientCompanyAction({
        companyId: company.id,
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        name: String(formData.get("name") ?? "").trim(),
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      clearErrors();
      onVersion(result.data.version);
      close();
    });
  return (
    <WorkspaceDisclosure
      description="Client users see this name in the portal."
      title="Rename company"
      trigger={
        <WorkspaceButton className="btn btn-sm btn-secondary" type="button">
          Rename
        </WorkspaceButton>
      }
    >
      {(close) => (
        <form
          aria-busy={pending || undefined}
          className="panel-b stack clients-dialog-body"
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            rename(new FormData(event.currentTarget), close);
          }}
        >
          <div className="field">
            <label htmlFor={`${formId}-name`}>Company name</label>
            <WorkspaceInput
              autoComplete="organization"
              className="input"
              defaultValue={company.name}
              id={`${formId}-name`}
              maxLength={COMPANY_NAME_MAX}
              name="name"
              required
              {...fieldProps("name")}
            />
            <WorkspaceFieldError errors={errors} field="name" formId={formId} />
          </div>
          <WorkspaceFormError errors={errors} />
          <div className="acts">
            <WorkspaceButton
              aria-busy={pending || undefined}
              className="btn btn-primary"
              disabled={pending}
              type="submit"
            >
              {pending ? "Saving…" : "Save name"}
            </WorkspaceButton>
          </div>
        </form>
      )}
    </WorkspaceDisclosure>
  );
};

const ClientCompanyStatusControl = ({
  company,
  onError,
  onVersion,
  version,
}: {
  readonly company: CompanyRef;
  readonly onError: (message: string | null) => void;
  readonly onVersion: VersionSink;
  readonly version: number;
}) => {
  const [pending, startTransition] = useTransition();
  const change = (activate: boolean) =>
    startTransition(async () => {
      const input = {
        companyId: company.id,
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
      };
      const result = activate
        ? await reactivateClientCompanyAction(input)
        : await deactivateClientCompanyAction(input);
      if (!result.ok) {
        onError(result.error.message);
        return;
      }
      onError(null);
      onVersion(result.data.version);
    });

  if (!company.active) {
    return (
      <WorkspaceConfirmDialog
        confirmLabel="Reactivate"
        description={`${company.name} becomes active again. Its users stay deactivated; reactivate the ones who should regain access from the Users tab.`}
        onConfirm={() => change(true)}
        title="Reactivate company?"
      >
        <WorkspaceButton
          className="btn btn-sm btn-secondary"
          disabled={pending}
          type="button"
        >
          {pending ? "Reactivating…" : "Reactivate"}
        </WorkspaceButton>
      </WorkspaceConfirmDialog>
    );
  }
  return (
    <WorkspaceConfirmDialog
      confirmLabel="Deactivate"
      description={`All users of ${company.name} are deactivated and signed out everywhere, so nobody from the company can report bugs. Existing bugs are kept.`}
      onConfirm={() => change(false)}
      title="Deactivate company?"
    >
      <WorkspaceButton
        className="btn btn-sm btn-ghost"
        disabled={pending}
        type="button"
      >
        {pending ? "Deactivating…" : "Deactivate"}
      </WorkspaceButton>
    </WorkspaceConfirmDialog>
  );
};

export {
  ClientCompanyCreateForm,
  ClientCompanyRenameForm,
  ClientCompanyStatusControl,
};
export type { CompanyRef, VersionSink };
