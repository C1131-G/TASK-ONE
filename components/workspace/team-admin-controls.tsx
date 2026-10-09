/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteTeamAction, updateTeamAction } from "@/app/actions/teams";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";

interface Team {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly color: string;
  readonly memberCount: number;
}

export const TeamAdminControls = ({ team }: { readonly team: Team }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateTeamAction({
        idempotencyKey: crypto.randomUUID(),
        team: {
          color: String(formData.get("color")),
          description: String(formData.get("description") ?? "").trim() || null,
          name: String(formData.get("name") ?? "").trim(),
        },
        teamId: team.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteTeamAction({
        idempotencyKey: crypto.randomUUID(),
        teamId: team.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });

  return (
    <details className="team-admin-controls">
      <summary className="ibtn ibtn-sm" aria-label={`Manage ${team.name}`}>
        Manage
      </summary>
      <div className="panel-b stack">
        <form action={save} className="stack">
          <label className="field">
            <span>Team name</span>
            <WorkspaceInput
              className="input"
              defaultValue={team.name}
              maxLength={80}
              name="name"
              required
            />
          </label>
          <label className="field">
            <span>Description</span>
            <WorkspaceInput
              className="input"
              defaultValue={team.description ?? ""}
              maxLength={500}
              name="description"
            />
          </label>
          <label className="field">
            <span>Color</span>
            <WorkspaceInput
              className="input"
              defaultValue={team.color}
              name="color"
              type="color"
            />
          </label>
          <WorkspaceButton
            className="btn btn-sm btn-secondary"
            disabled={pending}
            type="submit"
          >
            Save team
          </WorkspaceButton>
        </form>
        <p className="muted">{team.memberCount} members</p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <WorkspaceButton
          className="btn btn-sm btn-ghost"
          disabled={pending || team.memberCount > 0}
          onClick={remove}
          type="button"
        >
          Delete team
        </WorkspaceButton>
      </div>
    </details>
  );
};
