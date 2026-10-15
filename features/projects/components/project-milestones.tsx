/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { CheckCircle, Circle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import { saveProjectMilestonesAction } from "@/features/projects/projects-actions";

interface MilestoneData {
  readonly id: string | null;
  readonly name: string;
  readonly dueDate: string | null;
  readonly completed: boolean;
}

interface Milestone extends MilestoneData {
  readonly key: string;
}

const toMilestones = (items: readonly MilestoneData[]): readonly Milestone[] =>
  items.map((milestone, index) => ({
    ...milestone,
    key: milestone.id ?? `initial-${index}`,
  }));

const serializeMilestones = (items: readonly Milestone[]): string =>
  JSON.stringify(
    items.map(({ id, name, dueDate, completed }) => ({
      completed,
      dueDate,
      id,
      name,
    }))
  );

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
  const [milestones, setMilestones] = useState(() =>
    toMilestones(initialMilestones)
  );
  const currentVersion = useRef(version);
  const baseline = useRef<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (version === currentVersion.current) {
      return;
    }
    if (
      serializeMilestones(milestones) !==
      (baseline.current ?? serializeMilestones(toMilestones(initialMilestones)))
    ) {
      // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change, react-doctor/no-chain-state-updates
      setConflict(true);
      return;
    }
    const incoming = toMilestones(initialMilestones);
    currentVersion.current = version;
    baseline.current = serializeMilestones(incoming);
    // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change, react-doctor/no-chain-state-updates
    setMilestones(incoming);
    // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change, react-doctor/no-chain-state-updates
    setConflict(false);
  }, [initialMilestones, milestones, version, baseline]);

  const reload = () => {
    const incoming = toMilestones(initialMilestones);
    currentVersion.current = version;
    baseline.current = serializeMilestones(incoming);
    setMilestones(incoming);
    setConflict(false);
    setError(null);
  };

  const updateMilestone = (index: number, patch: Partial<Milestone>) =>
    setMilestones((current) =>
      current.map((milestone, itemIndex) =>
        itemIndex === index ? { ...milestone, ...patch } : milestone
      )
    );

  const save = () =>
    startTransition(async () => {
      if (conflict) {
        return;
      }
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
      const saved = toMilestones(result.data.milestones);
      baseline.current = serializeMilestones(saved);
      setMilestones(saved);
      setConflict(false);
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
            disabled={pending || conflict}
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
      {conflict ? (
        <div className="panel-b error" role="alert">
          Milestones changed elsewhere. Reload before editing or saving.
          <WorkspaceButton onClick={reload} type="button" workspace>
            Reload milestones
          </WorkspaceButton>
        </div>
      ) : null}
      <div className="panel-b stack">
        {milestones.map((milestone, index) => (
          <div className="row milestone" key={milestone.key}>
            {editable ? (
              <Checkbox
                aria-label={`Milestone ${index + 1} complete`}
                checked={milestone.completed}
                disabled={conflict}
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
                disabled={conflict}
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
                disabled={conflict}
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
                disabled={conflict}
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
            disabled={conflict}
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
