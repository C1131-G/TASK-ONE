/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";

import { FIELDS, IMPACTS, WEEKDAYS } from "./sla-settings-drafts";
import type {
  Drafts,
  ImpactKey,
  TargetDraft,
  TargetField,
  Unit,
} from "./sla-settings-drafts";

export const DaysFieldset = ({
  days,
  onToggle,
  pending,
}: {
  readonly days: readonly number[];
  readonly onToggle: (day: number, checked: boolean) => void;
  readonly pending: boolean;
}) => (
  <fieldset className="sla-fieldset" disabled={pending}>
    <legend>Business days</legend>
    <div className="sla-days">
      {WEEKDAYS.map(({ label, name, value }) => {
        const id = `sla-day-${value}`;
        return (
          <label className="sla-day" htmlFor={id} key={value}>
            <Checkbox
              aria-label={name}
              checked={days.includes(value)}
              id={id}
              onCheckedChange={(checked) => onToggle(value, checked === true)}
            />
            <span aria-hidden="true">{label}</span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

export const TargetsFieldset = ({
  dayHours,
  drafts,
  onChange,
  pending,
}: {
  readonly dayHours: number;
  readonly drafts: Drafts;
  readonly onChange: (
    impact: ImpactKey,
    field: TargetField,
    patch: Partial<TargetDraft>
  ) => void;
  readonly pending: boolean;
}) => (
  <fieldset className="sla-fieldset" disabled={pending}>
    <legend>Targets by impact</legend>
    <p className="muted sla-help">
      Whole numbers of business time. One business day equals your opening hours
      ({dayHours > 0 ? `${dayHours} hours` : "set valid hours"}). Resolution
      must not be shorter than first response.
    </p>
    <div className="tbl-wrap sla-table-wrap">
      <table className="tbl sla-table">
        <caption className="sr-only">
          First response and resolution targets for each impact level
        </caption>
        <thead>
          <tr>
            <th scope="col">Impact</th>
            {FIELDS.map(({ key, label }) => (
              <th key={key} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {IMPACTS.map(({ key: impact, label: impactLabel }) => (
            <tr key={impact}>
              <th scope="row">{impactLabel}</th>
              {FIELDS.map(({ key: field, label: fieldLabel }) => {
                const draft = drafts[impact][field];
                const base = `sla-${impact}-${field}`;
                return (
                  <td key={field}>
                    <div className="sla-target">
                      <WorkspaceInput
                        aria-label={`${impactLabel} ${fieldLabel.toLowerCase()} target`}
                        className="input"
                        id={`${base}-value`}
                        inputMode="decimal"
                        min={0}
                        onChange={(event) =>
                          onChange(impact, field, {
                            value: event.target.value,
                          })
                        }
                        step="any"
                        type="number"
                        value={draft.value}
                      />
                      <WorkspaceSelect
                        ariaLabel={`${impactLabel} ${fieldLabel.toLowerCase()} unit`}
                        className="input"
                        disabled={pending}
                        id={`${base}-unit`}
                        onValueChange={(next) =>
                          onChange(impact, field, { unit: next as Unit })
                        }
                        value={draft.unit}
                      >
                        <WorkspaceSelectItem value="minutes">
                          minutes
                        </WorkspaceSelectItem>
                        <WorkspaceSelectItem value="hours">
                          hours
                        </WorkspaceSelectItem>
                        <WorkspaceSelectItem value="days">
                          business days
                        </WorkspaceSelectItem>
                      </WorkspaceSelect>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </fieldset>
);
