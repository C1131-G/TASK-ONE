/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

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
import { relateBugAction } from "@/features/bugs/bugs-actions";

import { formatBugDate } from "../bug-workflow-ui-shared";
import type { BugHistory, BugSubmit } from "../bug-workflow-ui-shared";

export const BugRelatedHistorySection = ({
  history,
  isReadOnly,
  canEdit,
  submit,
}: {
  readonly history: BugHistory;
  readonly isReadOnly: boolean;
  readonly canEdit: boolean;
  readonly submit: BugSubmit;
}) => {
  const [relatedBugId, setRelatedBugId] = useState("");
  const [relationType, setRelationType] = useState("recurrence");
  return (
    <section className="panel panel-b bug-detail-section">
      <h2>Related bugs and history</h2>
      <div className="bug-related-list">
        {history.relations.map(({ bug, type }) => (
          <a href={`/bugs/${bug.id}`} key={`${type}-${bug.id}`}>
            {type === "recurrence" ? "Recurrence of" : "Duplicate of"}{" "}
            {bug.projectKey}-{bug.projectTaskNumber} · {bug.title}
          </a>
        ))}
      </div>
      {!isReadOnly && canEdit ? (
        <form
          className="bug-inline-form"
          onSubmit={(event) =>
            submit(event, (formData) =>
              relateBugAction({
                bugId: history.bug.id,
                expectedVersion: history.bug.version,
                relatedBugId: String(formData.get("relatedBugId") ?? ""),
                type: relationType,
              })
            )
          }
        >
          <div className="bug-form-field">
            <Label htmlFor="bug-related-id">Earlier or duplicate bug ID</Label>
            <Input
              id="bug-related-id"
              name="relatedBugId"
              onChange={(event) => setRelatedBugId(event.currentTarget.value)}
              required
              value={relatedBugId}
            />
          </div>
          <div className="bug-form-field">
            <Label htmlFor="bug-relation-type">Relationship</Label>
            <Select onValueChange={setRelationType} value={relationType}>
              <SelectTrigger id="bug-relation-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recurrence">Recurrence of</SelectItem>
                <SelectItem value="duplicate">Duplicate of</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Link bug history</Button>
        </form>
      ) : null}
      <div className="bug-decision-history">
        {history.approvals.map((approval) => (
          <article className="bug-history-card" key={approval.id}>
            <header>
              <h3>
                Approval submitted · {formatBugDate(approval.submittedAt)}
              </h3>
              <span>{approval.status}</span>
            </header>
            {approval.rejectionReason ? (
              <p>
                <strong>Requested changes:</strong> {approval.rejectionReason}
              </p>
            ) : null}
            {approval.comment ? <p>{approval.comment}</p> : null}
          </article>
        ))}
      </div>
      <div className="bug-decision-history">
        {history.releases.map((release) => (
          <article className="bug-history-card" key={release.id}>
            <header>
              <h3>Released {release.version}</h3>
              <span>{release.environment}</span>
            </header>
            <p>
              {formatBugDate(release.releasedAt)} ·{" "}
              {release.postReleaseCheckPassed
                ? "Post-release check passed"
                : "Post-release check pending"}
            </p>
            {release.postReleaseCheckNotes ? (
              <p>{release.postReleaseCheckNotes}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};
