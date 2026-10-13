/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  decideBugApprovalAction,
  recordBugPostReleaseCheckAction,
  recordBugReleaseAction,
} from "@/features/bugs/bugs-actions";

import type {
  BugActionRunner,
  BugHistory,
  BugSubmit,
} from "../bug-workflow-ui-shared";

export const BugApprovalReleaseSection = ({
  history,
  isAdmin,
  pending,
  runAction,
  submit,
}: {
  readonly history: BugHistory;
  readonly isAdmin: boolean;
  readonly pending: boolean;
  readonly runAction: BugActionRunner;
  readonly submit: BugSubmit;
}) => {
  const [environment, setEnvironment] = useState("staging");
  if (!isAdmin || history.archived) {
    return null;
  }
  const pendingApproval = history.approvals
    .toReversed()
    .find(({ status }) => status === "pending");
  const latestApproved = history.approvals
    .toReversed()
    .find(({ status }) => status === "approved");
  const activeRelease =
    history.releases
      .toReversed()
      .find(({ postReleaseCheckPassed }) => !postReleaseCheckPassed) ??
    history.releases.at(-1);
  const { status } = history.bug;
  return (
    <>
      {pendingApproval && status === "awaiting_admin_approval" ? (
        <section className="panel panel-b bug-detail-section">
          <h2>Admin decision</h2>
          <p>
            Review the immutable fix snapshot and linked before/after evidence
            above.
          </p>
          <div className="bug-inline-actions">
            <Button
              disabled={pending}
              onClick={() =>
                runAction(
                  decideBugApprovalAction({
                    approvalId: pendingApproval.id,
                    comment: null,
                    decision: "approved",
                    expectedVersion: history.bug.version,
                    rejectionReason: null,
                  })
                )
              }
            >
              Approve for release
            </Button>
            <form
              className="bug-reject-form"
              onSubmit={(event) =>
                submit(event, (data) =>
                  decideBugApprovalAction({
                    approvalId: pendingApproval.id,
                    comment: null,
                    decision: "rejected",
                    expectedVersion: history.bug.version,
                    rejectionReason: String(data.get("rejectionReason") ?? ""),
                  })
                )
              }
            >
              <Label className="sr-only" htmlFor="bug-rejection-reason">
                Reason for rejection
              </Label>
              <Input
                id="bug-rejection-reason"
                name="rejectionReason"
                placeholder="Reason for requesting changes"
                required
              />
              <Button disabled={pending} variant="outline">
                Reject and return for changes
              </Button>
            </form>
          </div>
        </section>
      ) : null}
      {latestApproved && status === "approved_for_release" ? (
        <section className="panel panel-b bug-detail-section">
          <h2>Record release</h2>
          <form
            className="bug-inline-form"
            onSubmit={(event) =>
              submit(event, (data) =>
                recordBugReleaseAction({
                  approvalId: latestApproved.id,
                  bugId: history.bug.id,
                  environment,
                  expectedVersion: history.bug.version,
                  notes: String(data.get("releaseNotes") ?? "") || null,
                  version: String(data.get("releaseVersion") ?? ""),
                })
              )
            }
          >
            <div className="bug-form-field">
              <Label htmlFor="bug-release-version">Released version</Label>
              <Input id="bug-release-version" name="releaseVersion" required />
            </div>
            <div className="bug-form-field">
              <Label htmlFor="bug-release-environment">Environment</Label>
              <Select onValueChange={setEnvironment} value={environment}>
                <SelectTrigger id="bug-release-environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bug-form-field bug-form-wide">
              <Label htmlFor="bug-release-notes">Release notes</Label>
              <Textarea id="bug-release-notes" name="releaseNotes" rows={2} />
            </div>
            <Button disabled={pending}>Record release</Button>
          </form>
        </section>
      ) : null}
      {activeRelease && status === "released" ? (
        <section className="panel panel-b bug-detail-section">
          <h2>Post-release check</h2>
          <form
            className="bug-inline-form"
            onSubmit={(event) =>
              submit(event, (data) =>
                recordBugPostReleaseCheckAction({
                  bugId: history.bug.id,
                  expectedVersion: history.bug.version,
                  notes: String(data.get("postReleaseNotes") ?? ""),
                  passed: data.get("passed") === "true",
                  releaseId: activeRelease.id,
                })
              )
            }
          >
            <div className="bug-form-field">
              <Label htmlFor="bug-post-check">Results</Label>
              <Textarea
                id="bug-post-check"
                name="postReleaseNotes"
                required
                rows={3}
              />
            </div>
            <label
              className="bug-employee-option"
              htmlFor="bug-post-check-passed"
            >
              <Checkbox id="bug-post-check-passed" name="passed" value="true" />{" "}
              Check passed; close this bug
            </label>
            <Button disabled={pending}>Record check</Button>
          </form>
        </section>
      ) : null}
    </>
  );
};
