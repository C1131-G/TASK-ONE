/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { SpinnerGap, UploadSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addBugEvidenceAction } from "@/features/bugs/bugs-actions";
import {
  BugEvidenceHistory,
  BugEvidenceResource,
} from "@/features/bugs/components/bug-evidence-history";
import {
  finalizeUploadAction,
  requestTaskUploadAction,
} from "@/features/files/files-actions";

import { formatBugDate } from "../bug-workflow-ui-shared";
import type { BugHistory, BugSubmit } from "../bug-workflow-ui-shared";

export const BugEvidenceSection = ({
  canEdit,
  history,
  isReadOnly,
  latestAttempt,
  onError,
  openFile,
  pending,
  submit,
}: {
  readonly canEdit: boolean;
  readonly history: BugHistory;
  readonly isReadOnly: boolean;
  readonly latestAttempt: BugHistory["attempts"][number] | null;
  readonly onError: (message: string) => void;
  readonly openFile: (fileId: string, preview: boolean) => Promise<void>;
  readonly pending: boolean;
  readonly submit: BugSubmit;
}) => {
  const router = useRouter();
  const [evidenceKind, setEvidenceKind] = useState("before");
  const [fileBusy, setFileBusy] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const uploadEvidence = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setFileBusy(true);
    try {
      const ticket = await requestTaskUploadAction({
        contentType: file.type || "application/octet-stream",
        fileName: file.name,
        sizeBytes: file.size,
        taskId: history.bug.taskId,
      });
      if (ticket.ok === false) {
        onError(ticket.error.message);
        setFileBusy(false);
        return;
      }
      const response = await fetch(ticket.data.uploadUrl, {
        body: file,
        headers: ticket.data.requiredHeaders,
        method: "PUT",
      });
      if (!response.ok) {
        onError(
          `Upload failed for ${file.name}. Check the storage configuration and try again.`
        );
        setFileBusy(false);
        return;
      }
      const finalized = await finalizeUploadAction({
        idempotencyKey: crypto.randomUUID(),
        uploadIntentId: ticket.data.uploadIntentId,
      });
      if (finalized.ok === false) {
        onError(finalized.error.message);
        setFileBusy(false);
        return;
      }
      const attached = await addBugEvidenceAction({
        bugId: history.bug.id,
        caption: file.name,
        expectedVersion: history.bug.version,
        externalUrl: null,
        fileAssetId: finalized.data.id,
        fixAttemptId: latestAttempt?.id ?? null,
        kind: evidenceKind,
      });
      if (attached.ok === false) {
        onError(attached.error.message);
        setFileBusy(false);
        return;
      }
      router.refresh();
      setFileInputKey((value) => value + 1);
    } catch {
      onError("Upload failed. Check the storage configuration and try again.");
    }
    setFileBusy(false);
  };

  if (!canEdit || isReadOnly) {
    return (
      <section className="panel panel-b bug-detail-section">
        <h2>Evidence history</h2>
        <BugEvidenceHistory history={history} openFile={openFile} />
      </section>
    );
  }
  const beforeEvidence = history.evidence.filter(
    ({ kind }) => kind === "before"
  );
  const afterEvidence = history.evidence.filter(({ kind }) => kind === "after");
  return (
    <section className="panel panel-b bug-detail-section">
      <h2>Before and after evidence</h2>
      <div className="bug-evidence-columns">
        {[
          { items: beforeEvidence, kind: "before", title: "Before the fix" },
          { items: afterEvidence, kind: "after", title: "After the fix" },
        ].map(({ kind, title, items }) => (
          <div className="bug-evidence-column" key={kind}>
            <h3>{title}</h3>
            {items.map((item) => (
              <article className="bug-evidence-item" key={item.id}>
                <p>{item.caption}</p>
                <small>{formatBugDate(item.createdAt)}</small>
                <BugEvidenceResource
                  externalUrl={item.externalUrl}
                  file={item.file}
                  openFile={openFile}
                />
              </article>
            ))}
          </div>
        ))}
      </div>
      <form
        className="bug-inline-form"
        onSubmit={(event) =>
          submit(event, (data) =>
            addBugEvidenceAction({
              bugId: history.bug.id,
              caption: String(data.get("caption") ?? ""),
              expectedVersion: history.bug.version,
              externalUrl: String(data.get("externalUrl") ?? "") || null,
              fileAssetId: null,
              fixAttemptId: latestAttempt?.id ?? null,
              kind: evidenceKind,
            })
          )
        }
      >
        <div className="bug-form-field">
          <Label htmlFor="bug-evidence-kind">Evidence stage</Label>
          <Select onValueChange={setEvidenceKind} value={evidenceKind}>
            <SelectTrigger id="bug-evidence-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="before">Before</SelectItem>
              <SelectItem value="after">After</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="bug-form-field">
          <Label htmlFor="bug-evidence-caption">Caption</Label>
          <Input id="bug-evidence-caption" name="caption" required />
        </div>
        <div className="bug-form-field bug-form-wide">
          <Label htmlFor="bug-evidence-url">Evidence link (HTTPS)</Label>
          <Input id="bug-evidence-url" name="externalUrl" type="url" />
        </div>
        <Button disabled={pending} type="submit">
          Add link
        </Button>
      </form>
      <div className="bug-evidence-upload">
        <Label htmlFor="bug-evidence-file">Upload evidence</Label>
        <Input
          accept="image/*,video/*,application/pdf,text/plain"
          disabled={fileBusy}
          id="bug-evidence-file"
          key={fileInputKey}
          onChange={(event) => uploadEvidence(event.currentTarget.files?.[0])}
          type="file"
        />
        <span className="bug-field-help">
          Private uploads up to 50 MB. The file is attached only after storage
          verification.
        </span>
        {fileBusy ? (
          <SpinnerGap
            aria-label="Uploading evidence"
            className="animate-spin"
            size={18}
          />
        ) : (
          <UploadSimple aria-hidden="true" size={18} />
        )}
      </div>
    </section>
  );
};
