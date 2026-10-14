/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle -- Bug views use reference workspace CSS classes. */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addBugFixAttemptAction } from "@/features/bugs/bugs-actions";

import { formatBugDate } from "../bug-workflow-ui-shared";
import type { BugHistory, BugSubmit } from "../bug-workflow-ui-shared";

export const BugInvestigationSection = ({
  canEdit,
  history,
  isReadOnly,
  pending,
  submit,
}: {
  readonly canEdit: boolean;
  readonly history: BugHistory;
  readonly isReadOnly: boolean;
  readonly pending: boolean;
  readonly submit: BugSubmit;
}) => {
  if (
    !canEdit ||
    isReadOnly ||
    !["triaged", "in_progress", "rejected"].includes(history.bug.status)
  ) {
    return null;
  }
  return (
    <section className="panel panel-b bug-detail-section">
      <h2>Investigation and fix</h2>
      <form
        className="bug-detail-form-grid"
        onSubmit={(event) =>
          submit(event, (formData) =>
            addBugFixAttemptAction({
              affectedVersion:
                String(formData.get("affectedVersion") ?? "") || null,
              bugId: history.bug.id,
              commitUrl: String(formData.get("commitUrl") ?? "") || null,
              expectedVersion: history.bug.version,
              fixSummary: String(formData.get("fixSummary") ?? ""),
              fixedVersion: String(formData.get("fixedVersion") ?? "") || null,
              pullRequestUrl:
                String(formData.get("pullRequestUrl") ?? "") || null,
              rootCause: String(formData.get("rootCause") ?? ""),
              verificationSteps: String(formData.get("verificationSteps") ?? "")
                .split("\n")
                .map((step) => step.trim())
                .filter(Boolean),
            })
          )
        }
      >
        <div className="bug-form-field">
          <Label htmlFor="bug-root-cause">Root cause</Label>
          <Textarea id="bug-root-cause" name="rootCause" required rows={3} />
        </div>
        <div className="bug-form-field">
          <Label htmlFor="bug-fix-summary">Fix summary</Label>
          <Textarea id="bug-fix-summary" name="fixSummary" required rows={3} />
        </div>
        <div className="bug-form-field bug-form-wide">
          <Label htmlFor="bug-verification-steps">Verification steps</Label>
          <Textarea
            id="bug-verification-steps"
            name="verificationSteps"
            placeholder={"Run the affected flow\nConfirm the corrected result"}
            required
            rows={3}
          />
        </div>
        <div className="bug-form-field">
          <Label htmlFor="bug-affected-version">Affected version</Label>
          <Input id="bug-affected-version" name="affectedVersion" />
        </div>
        <div className="bug-form-field">
          <Label htmlFor="bug-fixed-version">Fixed version</Label>
          <Input id="bug-fixed-version" name="fixedVersion" />
        </div>
        <div className="bug-form-field">
          <Label htmlFor="bug-commit">Commit URL</Label>
          <Input id="bug-commit" name="commitUrl" type="url" />
        </div>
        <div className="bug-form-field">
          <Label htmlFor="bug-pr">Pull request URL</Label>
          <Input id="bug-pr" name="pullRequestUrl" type="url" />
        </div>
        <Button className="bug-form-wide" disabled={pending} type="submit">
          Save fix attempt
        </Button>
      </form>
      {history.attempts.length > 0 ? (
        <div className="bug-attempt-history">
          {history.attempts.map((attempt) => (
            <article className="bug-history-card" key={attempt.id}>
              <header>
                <h3>Fix attempt · {formatBugDate(attempt.createdAt)}</h3>
                <span>{attempt.verificationOutcome ?? "Not verified"}</span>
              </header>
              <p>
                <strong>Root cause:</strong> {attempt.rootCause}
              </p>
              <p>
                <strong>Fix:</strong> {attempt.fixSummary}
              </p>
              {attempt.verificationOutcome ? (
                <p>
                  <strong>Verification:</strong> {attempt.verificationOutcome} ·{" "}
                  {attempt.testedEnvironment} · {attempt.testedVersion}
                </p>
              ) : null}
              {attempt.commitUrl ? (
                <a
                  href={attempt.commitUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View commit
                </a>
              ) : null}
              {attempt.pullRequestUrl ? (
                <a
                  href={attempt.pullRequestUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View pull request
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No fix attempts recorded yet.</p>
      )}
    </section>
  );
};
