/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  closeClientBugNotABugAction,
  requestClientInfoAction,
} from "@/features/bugs/bugs-actions";

interface DialogConfig {
  readonly action: (input: {
    bugId: string;
    expectedVersion: number;
    question?: string;
    reason?: string;
  }) => Promise<
    | { readonly ok: true }
    | { readonly ok: false; readonly error: { readonly message: string } }
  >;
  readonly description: string;
  readonly field: "question" | "reason";
  readonly help: string;
  readonly label: string;
  readonly pendingLabel: string;
  readonly submitLabel: string;
  readonly title: string;
  readonly triggerLabel: string;
}

const ClientMessageDialog = ({
  bugId,
  config,
  version,
}: {
  readonly bugId: string;
  readonly config: DialogConfig;
  readonly version: number;
}) => {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      setError(`${config.label} is required.`);
      return;
    }
    startTransition(async () => {
      const result = await config.action({
        bugId,
        expectedVersion: version,
        [config.field]: value,
      });
      if (result.ok) {
        setError(null);
        setText("");
        setOpen(false);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {config.triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="workspace-app">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <form className="bug-inline-form" onSubmit={submit}>
          <div className="bug-form-field">
            <Label htmlFor={`${id}-text`}>{config.label}</Label>
            <Textarea
              aria-describedby={`${id}-help`}
              aria-invalid={error ? true : undefined}
              id={`${id}-text`}
              onChange={(event) => setText(event.target.value)}
              required
              rows={4}
              value={text}
            />
            <p className="muted" id={`${id}-help`}>
              {config.help}
            </p>
          </div>
          {error ? (
            <p className="bug-form-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button disabled={pending} type="submit">
            {pending ? config.pendingLabel : config.submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AskClientDialog = ({
  bugId,
  version,
}: {
  readonly bugId: string;
  readonly version: number;
}) => (
  <ClientMessageDialog
    bugId={bugId}
    config={{
      action: requestClientInfoAction,
      description:
        "The bug moves to Needs info and your question is posted as a public comment the client can see.",
      field: "question",
      help: "The client is reminded after 3 days without a reply, and the bug closes automatically after 14 days.",
      label: "Question for the client",
      pendingLabel: "Sending…",
      submitLabel: "Ask client",
      title: "Ask the client",
      triggerLabel: "Ask client",
    }}
    version={version}
  />
);

const CloseNotABugDialog = ({
  bugId,
  version,
}: {
  readonly bugId: string;
  readonly version: number;
}) => (
  <ClientMessageDialog
    bugId={bugId}
    config={{
      action: closeClientBugNotABugAction,
      description: "The bug is closed as not a bug.",
      field: "reason",
      help: "Shown to the client as a public reply.",
      label: "Reason (shown to the client)",
      pendingLabel: "Closing…",
      submitLabel: "Close as not a bug",
      title: "Close as not a bug",
      triggerLabel: "Close as not a bug",
    }}
    version={version}
  />
);

export { AskClientDialog, CloseNotABugDialog };
