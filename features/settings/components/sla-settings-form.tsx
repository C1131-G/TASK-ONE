/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { updateSlaSettingsAction } from "@/features/company/sla-actions";
import { useSaveState } from "@/features/settings/hooks/use-settings-save";
import type { SlaSettingsValues } from "@/src/server/company/sla-settings";

type Unit = "minutes" | "hours" | "days";
type ImpactKey = "low" | "medium" | "high" | "urgent";
type TargetField = "firstResponseMinutes" | "resolutionMinutes";

interface TargetDraft {
  readonly unit: Unit;
  readonly value: string;
}

type Drafts = Record<ImpactKey, Record<TargetField, TargetDraft>>;

// Monday-first display order; values follow 0=Sunday..6=Saturday.
const WEEKDAYS = [
  { label: "Mon", name: "Monday", value: 1 },
  { label: "Tue", name: "Tuesday", value: 2 },
  { label: "Wed", name: "Wednesday", value: 3 },
  { label: "Thu", name: "Thursday", value: 4 },
  { label: "Fri", name: "Friday", value: 5 },
  { label: "Sat", name: "Saturday", value: 6 },
  { label: "Sun", name: "Sunday", value: 0 },
] as const;

const IMPACTS: readonly { readonly key: ImpactKey; readonly label: string }[] =
  [
    { key: "low", label: "Low" },
    { key: "medium", label: "Medium" },
    { key: "high", label: "High" },
    { key: "urgent", label: "Urgent" },
  ];

const FIELDS: readonly { readonly key: TargetField; readonly label: string }[] =
  [
    { key: "firstResponseMinutes", label: "First response" },
    { key: "resolutionMinutes", label: "Resolution" },
  ];

const SAME_ZONE = "__company__";
const MAX_MINUTES = 525_600;
const END_OF_DAY = 1440;

const minutesToTime = (minutes: number) => {
  const wrapped = minutes >= END_OF_DAY ? 0 : minutes;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  return `${hours}:${String(wrapped % 60).padStart(2, "0")}`;
};

// Closing 00:00 means midnight at the end of the day (1440).
const timeToMinutes = (time: string, isEnd: boolean) => {
  const [hours, minutes] = time.split(":").map(Number);
  const total = (hours ?? 0) * 60 + (minutes ?? 0);
  return isEnd && total === 0 ? END_OF_DAY : total;
};

const toDraft = (minutes: number, dayMinutes: number): TargetDraft => {
  if (dayMinutes > 0 && minutes >= dayMinutes && minutes % dayMinutes === 0) {
    return { unit: "days", value: String(minutes / dayMinutes) };
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return { unit: "hours", value: String(minutes / 60) };
  }
  return { unit: "minutes", value: String(minutes) };
};

const unitMinutes = (unit: Unit, dayMinutes: number) => {
  if (unit === "days") {
    return dayMinutes;
  }
  return unit === "hours" ? 60 : 1;
};

const DaysFieldset = ({
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

const TargetsFieldset = ({
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

const SlaSettingsForm = ({
  timeZones,
  values,
}: {
  readonly timeZones: readonly string[];
  readonly values: SlaSettingsValues;
}) => {
  const { error, pending, router, setError, startTransition } = useSaveState();
  const [saved, setSaved] = useState(false);
  const [days, setDays] = useState<readonly number[]>(
    () => values.businessDays
  );
  const [start, setStart] = useState(() =>
    minutesToTime(values.businessStartMinute)
  );
  const [end, setEnd] = useState(() => minutesToTime(values.businessEndMinute));
  const [zone, setZone] = useState(values.businessTimeZone ?? SAME_ZONE);
  const initialDay = values.businessEndMinute - values.businessStartMinute;
  const [drafts, setDrafts] = useState<Drafts>(() => {
    const build = (key: ImpactKey) => ({
      firstResponseMinutes: toDraft(
        values.slaTargets[key].firstResponseMinutes,
        initialDay
      ),
      resolutionMinutes: toDraft(
        values.slaTargets[key].resolutionMinutes,
        initialDay
      ),
    });
    return {
      high: build("high"),
      low: build("low"),
      medium: build("medium"),
      urgent: build("urgent"),
    };
  });

  const startMinute = timeToMinutes(start || "00:00", false);
  const endMinute = timeToMinutes(end || "00:00", true);
  const dayMinutes = Math.max(0, endMinute - startMinute);
  const dayHours = Math.round((dayMinutes / 60) * 100) / 100;
  const zoneOptions =
    timeZones.includes(zone) || zone === SAME_ZONE
      ? timeZones
      : [zone, ...timeZones];

  const toggleDay = (day: number, checked: boolean) => {
    setSaved(false);
    setDays((current) =>
      checked
        ? [...new Set([...current, day])]
        : current.filter((item) => item !== day)
    );
  };

  const setDraft = (
    impact: ImpactKey,
    field: TargetField,
    patch: Partial<TargetDraft>
  ) => {
    setSaved(false);
    setDrafts((current) => ({
      ...current,
      [impact]: {
        ...current[impact],
        [field]: { ...current[impact][field], ...patch },
      },
    }));
  };

  const readTargets = () => {
    const minutesFor = (impact: ImpactKey, field: TargetField) => {
      const draft = drafts[impact][field];
      const amount = Number(draft.value);
      if (!(draft.value.trim() && Number.isFinite(amount) && amount > 0)) {
        return null;
      }
      return Math.round(amount * unitMinutes(draft.unit, dayMinutes));
    };
    const targets = {} as Record<
      ImpactKey,
      { firstResponseMinutes: number; resolutionMinutes: number }
    >;
    for (const { key, label } of IMPACTS) {
      const first = minutesFor(key, "firstResponseMinutes");
      const resolution = minutesFor(key, "resolutionMinutes");
      if (first === null || resolution === null) {
        return {
          message: `Enter a first response and resolution target for ${label}.`,
        };
      }
      if (
        first < 1 ||
        resolution < 1 ||
        first > MAX_MINUTES ||
        resolution > MAX_MINUTES
      ) {
        return {
          message: `${label} targets must be between 1 minute and ${MAX_MINUTES.toLocaleString("en-US")} minutes of business time.`,
        };
      }
      targets[key] = {
        firstResponseMinutes: first,
        resolutionMinutes: resolution,
      };
    }
    return { targets };
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    if (days.length === 0) {
      setError("Choose at least one business day.");
      return;
    }
    if (endMinute <= startMinute) {
      setError("Business hours must end after they start.");
      return;
    }
    const parsed = readTargets();
    if (!parsed.targets) {
      setError(parsed.message ?? "Check the SLA targets.");
      return;
    }
    const { targets } = parsed;
    startTransition(async () => {
      const result = await updateSlaSettingsAction({
        businessDays: [...days].toSorted((left, right) => left - right),
        businessEndMinute: endMinute,
        businessStartMinute: startMinute,
        businessTimeZone: zone === SAME_ZONE ? null : zone,
        idempotencyKey: crypto.randomUUID(),
        slaTargets: targets,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <form
      aria-busy={pending}
      className="panel-b stack sla-form"
      noValidate
      onSubmit={save}
    >
      <p className="muted sla-help">
        Targets are measured in business time: only minutes inside the days,
        hours and time zone below are counted, and the clock pauses while the
        team is waiting on the client. A bug gets a warning at 75% of a target
        and a breach alert when the target passes.
      </p>

      <DaysFieldset days={days} pending={pending} onToggle={toggleDay} />

      <fieldset className="sla-fieldset" disabled={pending}>
        <legend>Business hours</legend>
        <div className="row">
          <label className="field" htmlFor="sla-start">
            <span>Opens</span>
            <WorkspaceInput
              className="input"
              id="sla-start"
              onChange={(event) => {
                setSaved(false);
                setStart(event.target.value);
              }}
              required
              type="time"
              value={start}
            />
          </label>
          <label className="field" htmlFor="sla-end">
            <span>Closes</span>
            <WorkspaceInput
              className="input"
              id="sla-end"
              onChange={(event) => {
                setSaved(false);
                setEnd(event.target.value);
              }}
              required
              type="time"
              value={end}
            />
          </label>
        </div>
        <p className="muted sla-help">
          Set closing to 00:00 to count until midnight (end of day).
          {dayMinutes > 0
            ? ` A business day is ${dayHours} hours.`
            : " Closing must be after opening."}
        </p>
      </fieldset>

      <label className="field" htmlFor="sla-zone">
        <span>Time zone</span>
        <WorkspaceSelect
          className="input"
          disabled={pending}
          id="sla-zone"
          onValueChange={(next) => {
            setSaved(false);
            setZone(next);
          }}
          value={zone}
        >
          <WorkspaceSelectItem value={SAME_ZONE}>
            Same as company time zone ({values.effectiveTimeZone})
          </WorkspaceSelectItem>
          {zoneOptions.map((item) => (
            <WorkspaceSelectItem key={item} value={item}>
              {item}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
      </label>

      <TargetsFieldset
        dayHours={dayHours}
        drafts={drafts}
        onChange={setDraft}
        pending={pending}
      />

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <output className="muted sla-saved">SLA settings saved.</output>
      ) : (
        <output className="sr-only" />
      )}
      <WorkspaceButton
        className="btn btn-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save SLA settings"}
      </WorkspaceButton>
    </form>
  );
};

export { SlaSettingsForm };
