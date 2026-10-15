/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BugPickForm } from "@/features/bugs/components/bug-pick-form";

export const BugPickDialog = ({
  bugId,
  severity,
  title,
  version,
}: {
  readonly bugId: string;
  readonly severity: "blocker" | "critical" | "major" | "minor" | "trivial";
  readonly title: string;
  readonly version: number;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="bug-open-drawer" size="sm" type="button">
          Pick
        </Button>
      </DialogTrigger>
      <DialogContent className="workspace-app">
        <DialogHeader>
          <DialogTitle>Pick this bug</DialogTitle>
          <DialogDescription>
            You become the only assignee for “{title}”. Set its severity and
            priority to start triage.
          </DialogDescription>
        </DialogHeader>
        <BugPickForm
          bugId={bugId}
          defaultSeverity={severity}
          expectedVersion={version}
          onPicked={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
