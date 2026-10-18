/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pickClientBugAction } from "@/features/bugs/bugs-client-actions";

type PickSeverity = "blocker" | "critical" | "major" | "minor" | "trivial";
type PickPriority = "urgent" | "high" | "medium" | "low" | "none";

const SEVERITIES: readonly (readonly [PickSeverity, string])[] = [
  ["blocker", "Blocker"],
  ["critical", "Critical"],
  ["major", "Major"],
  ["minor", "Minor"],
  ["trivial", "Trivial"],
];

const PRIORITIES: readonly (readonly [PickPriority, string])[] = [
  ["urgent", "Urgent"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
  ["none", "None"],
];

// Picking makes the viewer the sole assignee and triages the bug in one step.
export const BugPickForm = ({
  bugId,
  defaultSeverity,
  expectedVersion,
  onPicked,
}: {
  readonly bugId: string;
  readonly defaultSeverity: PickSeverity;
  readonly expectedVersion: number;
  readonly onPicked?: () => void;
}) => {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [severity, setSeverity] = useState<PickSeverity>(defaultSeverity);
  const [priority, setPriority] = useState<PickPriority>("medium");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await pickClientBugAction({
        bugId,
        expectedVersion,
        priority,
        severity,
      });
      if (result.ok) {
        setError(null);
        onPicked?.();
        router.refresh();
        return;
      }
      // Losing the race reports who won; refresh so the row reflects it.
      setError(result.error.message);
      if (result.error.code === "CONFLICT") {
        router.refresh();
      }
    });
  };

  return (
    <form className="bug-inline-form bug-pick-form" onSubmit={submit}>
      <div className="bug-detail-facts">
        <div className="bug-form-field">
          <Label htmlFor={`${id}-severity`}>Severity</Label>
          <Select
            onValueChange={(value) => setSeverity(value as PickSeverity)}
            value={severity}
          >
            <SelectTrigger className="w-full" id={`${id}-severity`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="bug-form-field">
          <Label htmlFor={`${id}-priority`}>Priority</Label>
          <Select
            onValueChange={(value) => setPriority(value as PickPriority)}
            value={priority}
          >
            <SelectTrigger className="w-full" id={`${id}-priority`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error ? (
        <p className="bug-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Picking…" : "Pick this bug"}
      </Button>
    </form>
  );
};
