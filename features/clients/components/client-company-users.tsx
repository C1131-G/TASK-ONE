/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import {
  createClientUserAction,
  unlockUserAction,
} from "@/features/clients/clients-actions";
import { TemporaryPasswordReveal } from "@/features/people/components/temporary-password-reveal";
import {
  deactivateEmployeeAction,
  reactivateEmployeeAction,
  resetEmployeePasswordAction,
} from "@/features/people/people-actions";
import type { ClientCompanyDetail } from "@/src/server/clients/client-company-contracts";

type ClientUser = ClientCompanyDetail["users"][number];

const lastActiveFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatLastActive = (value: string | null): string =>
  value ? lastActiveFormatter.format(new Date(value)) : "Never";

const AddClientUserDialog = ({
  companyId,
  companyName,
  disabled,
}: {
  readonly companyId: string;
  readonly companyName: string;
  readonly disabled: boolean;
}) => {
  const router = useRouter();
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
      router.refresh();
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

const ResetPasswordDialog = ({ user }: { readonly user: ClientUser }) => {
  const router = useRouter();
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
      router.refresh();
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

const ClientUserActions = ({
  companyActive,
  user,
}: {
  readonly companyActive: boolean;
  readonly user: ClientUser;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (
    action: () => Promise<
      | { readonly ok: true }
      | { readonly ok: false; readonly error: { readonly message: string } }
    >
  ) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  const deactivate = () =>
    run(() =>
      deactivateEmployeeAction({
        employeeId: user.id,
        idempotencyKey: crypto.randomUUID(),
      })
    );
  const reactivate = () =>
    run(() =>
      reactivateEmployeeAction({
        employeeId: user.id,
        idempotencyKey: crypto.randomUUID(),
      })
    );
  const unlock = () => run(() => unlockUserAction({ userId: user.id }));

  return (
    <div className="clients-row-actions">
      <div className="clients-row-buttons">
        <ResetPasswordDialog user={user} />
        {user.active && companyActive ? (
          // A plain link keeps Next from prefetching the audited preview.
          // oxlint-disable-next-line nextjs/no-html-link-for-pages
          <a
            aria-label={`View as client: ${user.name}`}
            className="btn btn-sm btn-ghost"
            href={`/portal/preview?as=${encodeURIComponent(user.id)}`}
          >
            View as client
          </a>
        ) : null}
        {user.locked ? (
          <WorkspaceButton
            aria-label={`Unlock ${user.name}`}
            className="btn btn-sm btn-ghost"
            disabled={pending}
            onClick={unlock}
            type="button"
          >
            Unlock
          </WorkspaceButton>
        ) : null}
        {user.active ? (
          <WorkspaceConfirmDialog
            confirmLabel="Deactivate"
            description={`${user.name} is signed out everywhere and can no longer sign in to the portal.`}
            onConfirm={deactivate}
            title={`Deactivate ${user.name}?`}
          >
            <WorkspaceButton
              aria-label={`Deactivate ${user.name}`}
              className="btn btn-sm btn-ghost"
              disabled={pending}
              type="button"
            >
              Deactivate
            </WorkspaceButton>
          </WorkspaceConfirmDialog>
        ) : (
          <WorkspaceButton
            aria-label={`Reactivate ${user.name}`}
            className="btn btn-sm btn-ghost"
            disabled={pending || !companyActive}
            onClick={reactivate}
            title={
              companyActive
                ? undefined
                : "Reactivate the company before its users."
            }
            type="button"
          >
            Reactivate
          </WorkspaceButton>
        )}
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

const ClientCompanyUsers = ({
  companyActive,
  companyId,
  companyName,
  users,
}: {
  readonly companyActive: boolean;
  readonly companyId: string;
  readonly companyName: string;
  readonly users: readonly ClientUser[];
}) => (
  <section
    aria-labelledby="client-users-heading"
    className="panel clients-panel"
  >
    <div className="panel-h clients-panel-h">
      <div>
        <h2 id="client-users-heading">Users</h2>
        {companyActive ? (
          <p className="clients-preview-note">
            Read-only preview; recorded in the audit log
          </p>
        ) : (
          <p className="muted">
            Reactivate the company to add users or restore their access.
          </p>
        )}
      </div>
      <AddClientUserDialog
        companyId={companyId}
        companyName={companyName}
        disabled={!companyActive}
      />
    </div>
    {users.length ? (
      <Table className="clients-table clients-users-table">
        <TableCaption className="sr-only">
          Client users of {companyName}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <span className="clients-person">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </span>
              </TableCell>
              <TableCell>
                <span className="clients-badges">
                  {user.active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Deactivated</Badge>
                  )}
                  {user.locked ? (
                    <Badge variant="destructive">Locked</Badge>
                  ) : null}
                  {user.mustChangePassword ? (
                    <Badge variant="outline">Must change password</Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="clients-nowrap">
                {formatLastActive(user.lastActiveAt)}
              </TableCell>
              <TableCell>
                <ClientUserActions companyActive={companyActive} user={user} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ) : (
      <div className="panel-b muted">
        No client users yet. Add one so the company can report bugs.
      </div>
    )}
  </section>
);

export { ClientCompanyUsers };
