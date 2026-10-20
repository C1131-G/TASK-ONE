/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import { createClientUserAction } from "@/features/clients/clients-actions";
import { TemporaryPasswordReveal } from "@/features/people/components/temporary-password-reveal";
import { resetEmployeePasswordAction } from "@/features/people/people-actions";
import type { ClientCompanyDetail } from "@/src/server/clients/client-company-contracts";

export type ClientUser = ClientCompanyDetail["users"][number];

export const AddClientUserDialog = ({
  companyId,
  companyName,
  disabled,
}: {
  readonly companyId: string;
  readonly companyName: string;
  readonly disabled: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    readonly email: string;
    readonly temporaryPassword: string;
  } | null>(null);

  // The temporary password is shown once: closing the dialog forgets it.
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCreated(null);
      setError(null);
    }
  };

  const create = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    setError(null);
    startTransition(async () => {
      const result = await createClientUserAction({
        companyId,
        email: String(formData.get("email") ?? "").trim(),
        name: String(formData.get("name") ?? "").trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      form.reset();
      setCreated({
        email: result.data.email,
        temporaryPassword: result.data.temporaryPassword,
      });
    });
  };

  return (
    <WorkspaceModal
      description={`Create a portal account for someone at ${companyName}. They choose their own password at first sign in.`}
      onOpenChange={changeOpen}
      open={open}
      title="Add client user"
      trigger={
        <WorkspaceButton
          className="btn btn-primary btn-sm"
          disabled={disabled}
          type="button"
        >
          Add client user
        </WorkspaceButton>
      }
    >
      {created ? (
        <div className="panel-b stack clients-dialog-body">
          <TemporaryPasswordReveal
            note={`Send it to ${created.email} securely. It is shown once and must be changed at first sign in.`}
            password={created.temporaryPassword}
            title="Temporary password — share it securely now"
          />
          <div className="acts">
            <WorkspaceButton
              className="btn btn-secondary"
              onClick={() => setCreated(null)}
              type="button"
            >
              Add another
            </WorkspaceButton>
            <WorkspaceButton
              className="btn btn-primary"
              onClick={() => changeOpen(false)}
              type="button"
            >
              Done
            </WorkspaceButton>
          </div>
        </div>
      ) : (
        <form
          className="panel-b stack clients-dialog-body"
          onSubmit={(event) => {
            event.preventDefault();
            create(event.currentTarget);
          }}
        >
          <div className="row clients-form-row">
            <label className="field grow" htmlFor="client-user-create-name">
              <span>Name</span>
              <WorkspaceInput
                autoComplete="off"
                className="input"
                id="client-user-create-name"
                maxLength={120}
                name="name"
                required
              />
            </label>
            <label className="field grow" htmlFor="client-user-create-email">
              <span>Email</span>
              <WorkspaceInput
                autoComplete="off"
                className="input"
                id="client-user-create-email"
                maxLength={254}
                name="email"
                required
                type="email"
              />
            </label>
          </div>
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
              {pending ? "Creating…" : "Create account"}
            </WorkspaceButton>
          </div>
        </form>
      )}
    </WorkspaceModal>
  );
};

export const ResetPasswordDialog = ({
  user,
}: {
  readonly user: ClientUser;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null
  );

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setTemporaryPassword(null);
      setError(null);
    }
  };

  const reset = () =>
    startTransition(async () => {
      const result = await resetEmployeePasswordAction({
        employeeId: user.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setTemporaryPassword(result.data.temporaryPassword);
    });

  return (
    <WorkspaceModal
      description={`Replace the password for ${user.email} with a temporary one.`}
      onOpenChange={changeOpen}
      open={open}
      title="Reset password"
      trigger={
        <WorkspaceButton
          aria-label={`Reset password for ${user.name}`}
          className="btn btn-sm btn-ghost"
          disabled={!user.active}
          type="button"
        >
          Reset password
        </WorkspaceButton>
      }
    >
      <div className="panel-b stack clients-dialog-body">
        {temporaryPassword ? (
          <TemporaryPasswordReveal
            note="It is shown once. The user must change it at the next sign in."
            password={temporaryPassword}
            title="Temporary password — share it securely now"
          />
        ) : (
          <p className="muted">
            Their current password stops working immediately and they must
            choose a new one at the next sign in.
          </p>
        )}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="acts">
          {temporaryPassword ? (
            <WorkspaceButton
              className="btn btn-primary"
              onClick={() => changeOpen(false)}
              type="button"
            >
              Done
            </WorkspaceButton>
          ) : (
            <WorkspaceButton
              className="btn btn-primary"
              disabled={pending}
              onClick={reset}
              type="button"
            >
              {pending ? "Resetting…" : "Reset password"}
            </WorkspaceButton>
          )}
        </div>
      </div>
    </WorkspaceModal>
  );
};
