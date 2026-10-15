/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
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

const ClientCompanyCreateForm = () => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const create = (formData: FormData) =>
    startTransition(async () => {
      const result = await createClientCompanyAction({
        idempotencyKey: crypto.randomUUID(),
        name: String(formData.get("name") ?? "").trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.push(`/clients/${result.data.companyId}`);
      router.refresh();
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
        className="panel-b stack clients-dialog-body"
        onSubmit={(event) => {
          event.preventDefault();
          create(new FormData(event.currentTarget));
        }}
      >
        <label className="field" htmlFor="client-company-create-name">
          <span>Company name</span>
          <WorkspaceInput
            autoComplete="organization"
            className="input"
            id="client-company-create-name"
            maxLength={COMPANY_NAME_MAX}
            name="name"
            required
          />
        </label>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="acts">
          <WorkspaceButton
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rename = (formData: FormData, close: () => void) =>
    startTransition(async () => {
      const result = await updateClientCompanyAction({
        companyId: company.id,
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        name: String(formData.get("name") ?? "").trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      onVersion(result.data.version);
      close();
      router.refresh();
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
          className="panel-b stack clients-dialog-body"
          onSubmit={(event) => {
            event.preventDefault();
            rename(new FormData(event.currentTarget), close);
          }}
        >
          <label
            className="field"
            htmlFor={`client-company-${company.id}-name`}
          >
            <span>Company name</span>
            <WorkspaceInput
              autoComplete="organization"
              className="input"
              defaultValue={company.name}
              id={`client-company-${company.id}-name`}
              maxLength={COMPANY_NAME_MAX}
              name="name"
              required
            />
          </label>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="acts">
            <WorkspaceButton
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
  const router = useRouter();
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
      router.refresh();
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
