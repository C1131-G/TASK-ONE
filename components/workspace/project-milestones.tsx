/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { CheckCircle, Circle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { saveProjectMilestonesAction } from "@/app/actions/projects";
import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";

interface MilestoneData {
  readonly id: string | null;
  readonly name: string;
  readonly dueDate: string | null;
  readonly completed: boolean;
}

interface Milestone extends MilestoneData {
  readonly key: string;
}

export const ProjectMilestones = ({
  projectId,
  version,
  initialMilestones,
  editable,
}: {
  readonly projectId: string;
  readonly version: number;
  readonly initialMilestones: readonly MilestoneData[];
  readonly editable: boolean;
}) => {
  const router = useRouter();
  const [milestones, setMilestones] = useState<readonly Milestone[]>(() =>
    initialMilestones.map((item, index) => ({
      ...item,
      key: item.id ?? `initial-${index}`,
    }))
  );
  const currentVersion = useRef(version);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateMilestone = (index: number, patch: Partial<Milestone>) =>
    setMilestones((current) =>
      current.map((milestone, itemIndex) =>
        itemIndex === index ? { ...milestone, ...patch } : milestone
      )
    );

  const save = () =>
    startTransition(async () => {
      const result = await saveProjectMilestonesAction({
        expectedVersion: currentVersion.current,
        idempotencyKey: crypto.randomUUID(),
        milestones: milestones.map(({ key: _key, ...milestone }) => milestone),
        projectId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      currentVersion.current = result.data.version;
      setMilestones(
        result.data.milestones.map((item) => ({ ...item, key: item.id }))
      );
      router.refresh();
    });

  return (
    <section className="panel milestone-panel">
      <div className="panel-h row">
        <h2>Milestones</h2>
        <span className="sp" />
        {editable ? (
          <WorkspaceButton
            className="btn btn-sm btn-primary"
            disabled={pending}
            onClick={save}
            type="button"
          >
            {pending ? "Saving…" : "Save milestones"}
          </WorkspaceButton>
        ) : null}
      </div>
      {error ? (
        <p className="panel-b error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="panel-b stack">
        {milestones.map((milestone, index) => (
          <div className="row milestone" key={milestone.key}>
            {editable ? (
              <Checkbox
                aria-label={`Milestone ${index + 1} complete`}
                checked={milestone.completed}
                onCheckedChange={(checked) =>
                  updateMilestone(index, {
                    completed: checked === true,
                  })
                }
              />
            ) : (
              <span aria-hidden="true">
                {milestone.completed ? (
                  <CheckCircle size={16} weight="fill" />
                ) : (
                  <Circle size={16} />
                )}
              </span>
            )}
            {editable ? (
              <WorkspaceInput
                aria-label={`Milestone ${index + 1} name`}
                className="input grow"
                maxLength={120}
                onChange={(event) =>
                  updateMilestone(index, { name: event.currentTarget.value })
                }
                value={milestone.name}
              />
            ) : (
              <strong className="grow">{milestone.name}</strong>
            )}
            {editable ? (
              <WorkspaceDatePicker
                ariaLabel={`Milestone ${index + 1} due date`}
                className="input"
                onValueChange={(value) =>
                  updateMilestone(index, { dueDate: value || null })
                }
                value={milestone.dueDate ?? ""}
              />
            ) : (
              <span className="muted">
                {milestone.dueDate ?? "No due date"}
              </span>
            )}
            {editable ? (
              <WorkspaceButton
                aria-label={`Remove milestone ${milestone.name || index + 1}`}
                className="ibtn ibtn-sm"
                onClick={() =>
                  setMilestones((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                type="button"
              >
                Remove
              </WorkspaceButton>
            ) : null}
          </div>
        ))}
        {milestones.length === 0 ? (
          <p className="muted">No milestones yet.</p>
        ) : null}
        {editable ? (
          <WorkspaceButton
            className="btn btn-sm btn-ghost"
            onClick={() =>
              setMilestones((current) => [
                ...current,
                {
                  completed: false,
                  dueDate: null,
                  id: null,
                  key: crypto.randomUUID(),
                  name: "",
                },
              ])
            }
            type="button"
          >
            Add milestone
          </WorkspaceButton>
        ) : null}
      </div>
    </section>
  );
};
