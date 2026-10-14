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
import { Textarea } from "@/components/ui/textarea";
import { verifyBugFixAction } from "@/features/bugs/bugs-actions";

import type { BugHistory, BugSubmit } from "../bug-workflow-ui-shared";

export const BugVerificationSection = ({
  canEdit,
  history,
  isReadOnly,
  latestAttempt,
  pending,
  submit,
}: {
  readonly canEdit: boolean;
  readonly history: BugHistory;
  readonly isReadOnly: boolean;
  readonly latestAttempt: BugHistory["attempts"][number] | null;
  readonly pending: boolean;
  readonly submit: BugSubmit;
}) => {
  const [environment, setEnvironment] = useState("staging");
  const [verificationOutcome, setVerificationOutcome] = useState("passed");
  if (
    isReadOnly ||
    !canEdit ||
    history.bug.status !== "in_progress" ||
    !latestAttempt ||
    latestAttempt.verifiedAt
  ) {
    return null;
  }
  return (
    <section className="panel panel-b bug-detail-section">
      <h2>Verify fix</h2>
      <form
        className="bug-detail-form-grid"
        onSubmit={(event) =>
          submit(event, (formData) =>
            verifyBugFixAction({
              attemptId: latestAttempt.id,
              bugId: history.bug.id,
              expectedVersion: history.bug.version,
              notes: String(formData.get("verificationNotes") ?? ""),
              outcome: verificationOutcome,
              testedEnvironment: environment,
              testedVersion: String(formData.get("testedVersion") ?? ""),
            })
          )
        }
      >
        <div className="bug-form-field">
          <Label htmlFor="bug-tested-version">Tested version</Label>
          <Input id="bug-tested-version" name="testedVersion" required />
        </div>
        <div className="bug-form-field">
          <Label htmlFor="bug-test-env">Tested environment</Label>
          <Select onValueChange={setEnvironment} value={environment}>
            <SelectTrigger id="bug-test-env">
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
        <div className="bug-form-field">
          <Label htmlFor="bug-outcome">Verification result</Label>
          <Select
            onValueChange={setVerificationOutcome}
            value={verificationOutcome}
          >
            <SelectTrigger id="bug-outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="bug-form-field bug-form-wide">
          <Label htmlFor="bug-verification-notes">Verification notes</Label>
          <Textarea
            id="bug-verification-notes"
            name="verificationNotes"
            required
            rows={3}
          />
        </div>
        <Button disabled={pending} type="submit">
          Record verification
        </Button>
      </form>
    </section>
  );
};
