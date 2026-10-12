/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

export interface TaskRelationOption {
  readonly id: string;
  readonly name: string;
}

export interface TaskLabelOption extends TaskRelationOption {
  readonly color: string;
}

export const TaskRelationsSection = ({
  labels,
  dependencies,
  selectedLabelIds,
  selectedDependencyIds,
  editable,
  pending,
  onSave,
}: {
  readonly labels: readonly TaskLabelOption[];
  readonly dependencies: readonly TaskRelationOption[];
  readonly selectedLabelIds: readonly string[];
  readonly selectedDependencyIds: readonly string[];
  readonly editable: boolean;
  readonly pending: boolean;
  readonly onSave: (formData: FormData) => void;
}) => {
  const selectedLabels = new Set(selectedLabelIds);
  const selectedDependencies = new Set(selectedDependencyIds);
  return (
    <section className="stack">
      <h3>Labels and dependencies</h3>
      {editable ? (
        <form action={onSave} className="stack">
          <fieldset className="field">
            <legend>Labels</legend>
            {labels.length ? (
              labels.map((label) => (
                <label
                  className="row"
                  key={label.id}
                  htmlFor={`label-${label.id}-field-81`}
                >
                  <Checkbox
                    defaultChecked={selectedLabels.has(label.id)}
                    name="labelIds"
                    value={label.id}
                    id={`label-${label.id}-field-81`}
                  />
                  <span
                    className="pdot"
                    style={{ "--c": label.color } as React.CSSProperties}
                  />
                  <span>{label.name}</span>
                </label>
              ))
            ) : (
              <p className="muted">No labels are available.</p>
            )}
          </fieldset>
          <fieldset className="field">
            <legend>Blocked by</legend>
            {dependencies.length ? (
              dependencies.map((dependency) => (
                <label
                  className="row"
                  key={dependency.id}
                  htmlFor={`dependency-${dependency.id}-field-102`}
                >
                  <Checkbox
                    defaultChecked={selectedDependencies.has(dependency.id)}
                    name="dependencyTaskIds"
                    value={dependency.id}
                    id={`dependency-${dependency.id}-field-102`}
                  />
                  <span>{dependency.name}</span>
                </label>
              ))
            ) : (
              <p className="muted">No other project tasks are available.</p>
            )}
          </fieldset>
          <WorkspaceButton
            className="btn btn-sm btn-secondary"
            disabled={pending}
            type="submit"
          >
            Save labels and dependencies
          </WorkspaceButton>
        </form>
      ) : (
        <div className="stack">
          <p className="muted">
            Labels:{" "}
            {labels
              .flatMap((label) =>
                selectedLabels.has(label.id) ? [label.name] : []
              )
              .join(", ") || "None"}
          </p>
          <p className="muted">
            Blocked by:{" "}
            {dependencies
              .flatMap((dependency) =>
                selectedDependencies.has(dependency.id) ? [dependency.name] : []
              )
              .join(", ") || "None"}
          </p>
        </div>
      )}
    </section>
  );
};
