/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const BugReproductionFields = () => (
  <>
    <div className="bug-form-field bug-form-wide">
      <Label htmlFor="bug-repro">Reproduction steps</Label>
      <Textarea
        id="bug-repro"
        name="reproductionSteps"
        placeholder={"Open the project\nChange a value\nSelect Save"}
        required
        rows={3}
      />
      <span className="bug-field-help">Enter one step per line.</span>
    </div>
    <div className="bug-form-field bug-form-wide">
      <Label htmlFor="bug-expected">Expected behavior</Label>
      <Textarea id="bug-expected" name="expectedBehavior" required rows={2} />
    </div>
    <div className="bug-form-field bug-form-wide">
      <Label htmlFor="bug-actual">Actual behavior</Label>
      <Textarea id="bug-actual" name="actualBehavior" required rows={2} />
    </div>
  </>
);

export const BugEnvironmentFields = () => (
  <details className="bug-form-details bug-form-wide">
    <summary>More environment details</summary>
    <div className="bug-form-grid">
      <div className="bug-form-field">
        <Label htmlFor="bug-version">Application version</Label>
        <Input id="bug-version" name="appVersion" />
      </div>
      <div className="bug-form-field">
        <Label htmlFor="bug-browser">Browser</Label>
        <Input id="bug-browser" name="browser" />
      </div>
      <div className="bug-form-field">
        <Label htmlFor="bug-device">Device</Label>
        <Input id="bug-device" name="device" />
      </div>
      <div className="bug-form-field">
        <Label htmlFor="bug-os">Operating system</Label>
        <Input id="bug-os" name="os" />
      </div>
      <div className="bug-form-field bug-form-wide">
        <Label htmlFor="bug-description">Additional context</Label>
        <Textarea id="bug-description" name="description" rows={2} />
      </div>
    </div>
  </details>
);
