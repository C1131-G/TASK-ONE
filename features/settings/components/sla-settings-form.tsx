/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { useSaveState } from "@/features/settings/hooks/use-settings-save";
import { updateSlaSettingsAction } from "@/features/settings/settings-actions";
import type { SlaSettingsValues } from "@/src/server/company/sla-settings";

import {
  SAME_ZONE,
  buildDrafts,
  minutesToTime,
  readSlaTargets,
  timeToMinutes,
} from "./sla-settings-drafts";
import type {
  Drafts,
  ImpactKey,
  TargetDraft,
  TargetField,
} from "./sla-settings-drafts";
import { DaysFieldset, TargetsFieldset } from "./sla-settings-fieldsets";

const SlaSettingsForm = ({
  timeZones,
  values,
}: {
  readonly timeZones: readonly string[];
  readonly values: SlaSettingsValues;
}) => {
  const { error, pending, setError, startTransition } = useSaveState();
  const [saved, setSaved] = useState(false);
  const [days, setDays] = useState<readonly number[]>(
    () => values.businessDays
  );
  const [start, setStart] = useState(() =>
    minutesToTime(values.businessStartMinute)
  );
  const [end, setEnd] = useState(() => minutesToTime(values.businessEndMinute));
  const [zone, setZone] = useState(values.businessTimeZone ?? SAME_ZONE);
  const [drafts, setDrafts] = useState<Drafts>(() => buildDrafts(values));

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
    const parsed = readSlaTargets(drafts, dayMinutes);
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
        aria-busy={pending || undefined}
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
