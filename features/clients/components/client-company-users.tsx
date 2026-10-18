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
import { unlockUserAction } from "@/features/clients/clients-actions";
import {
  deactivateEmployeeAction,
  reactivateEmployeeAction,
} from "@/features/people/people-actions";

import {
  AddClientUserDialog,
  ResetPasswordDialog,
} from "./client-user-dialogs";
import type { ClientUser } from "./client-user-dialogs";

const lastActiveFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatLastActive = (value: string | null): string =>
  value ? lastActiveFormatter.format(new Date(value)) : "Never";

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
