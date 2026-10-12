/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteTeamAction, updateTeamAction } from "@/app/actions/teams";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";

interface Team {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly color: string;
  readonly memberCount: number;
}

export const TeamAdminControls = ({
  team,
  triggerLabel = "Manage",
}: {
  readonly team: Team;
  readonly triggerLabel?: string;
}) => {
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
    <WorkspaceDisclosure
      description={`Manage the ${team.name} team details and membership.`}
      title={`Manage ${team.name}`}
      trigger={
        <WorkspaceButton
          aria-label={`${triggerLabel} ${team.name}`}
          className="ibtn ibtn-sm"
          type="button"
        >
          {triggerLabel}
        </WorkspaceButton>
      }
    >
      <div className="panel-b stack">
        <form action={save} className="stack">
          <label className="field" htmlFor={`team-${team.id}-field-75`}>
            <span>Team name</span>
            <WorkspaceInput
              className="input"
              defaultValue={team.name}
              maxLength={80}
              name="name"
              required
              id={`team-${team.id}-field-75`}
            />
          </label>
          <label className="field" htmlFor={`team-${team.id}-field-85`}>
            <span>Description</span>
            <WorkspaceInput
              className="input"
              defaultValue={team.description ?? ""}
              maxLength={500}
              name="description"
              id={`team-${team.id}-field-85`}
            />
          </label>
          <label className="field" htmlFor={`team-${team.id}-field-94`}>
            <span>Color</span>
            <WorkspaceInput
              className="input"
              defaultValue={team.color}
              name="color"
              type="color"
              id={`team-${team.id}-field-94`}
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
        <WorkspaceConfirmDialog
          confirmLabel="Delete team"
          description={`Delete the ${team.name} team? This cannot be undone.`}
          onConfirm={remove}
          title="Delete team"
        >
          <WorkspaceButton
            className="btn btn-sm btn-ghost"
            disabled={pending || team.memberCount > 0}
            type="button"
          >
            Delete team
          </WorkspaceButton>
        </WorkspaceConfirmDialog>
      </div>
    </WorkspaceDisclosure>
  );
};
