/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- These workspace classes are defined in app/workspace-styles to match the reference UI. */

import { Bug, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportBugAction } from "@/features/bugs/bugs-actions";
import {
  BugEnvironmentFields,
  BugReproductionFields,
} from "@/features/bugs/components/bug-report-fields";
import { SimilarBugResults } from "@/features/bugs/components/bug-similar-results";
import { useBugSimilarSearch } from "@/features/bugs/hooks/use-bug-similar-search";

interface BugProjectOption {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

export const BugReportDialog = ({
  initialProjectId,
  projects,
}: {
  readonly initialProjectId?: string;
  readonly projects: readonly BugProjectOption[];
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(
    initialProjectId ?? projects[0]?.id ?? ""
  );
  const [severity, setSeverity] = useState("major");
  const [environment, setEnvironment] = useState("production");
  const [discoverySource, setDiscoverySource] = useState("employee_report");
  const { findSimilarBugs, searchingSimilar, similarBugs } =
    useBugSimilarSearch(setMessage);

  const submit = async (formData: FormData) => {
    setBusy(true);
    setMessage(null);
    const reproductionSteps = String(formData.get("reproductionSteps") ?? "")
      .split("\n")
      .map((step) => step.trim())
      .filter(Boolean);
    try {
      const result = await reportBugAction({
        actualBehavior: String(formData.get("actualBehavior") ?? ""),
        appVersion: String(formData.get("appVersion") ?? "") || null,
        browser: String(formData.get("browser") ?? "") || null,
        component: String(formData.get("component") ?? ""),
        description: String(formData.get("description") ?? "") || null,
        device: String(formData.get("device") ?? "") || null,
        discoverySource,
        environment,
        expectedBehavior: String(formData.get("expectedBehavior") ?? ""),
        idempotencyKey: crypto.randomUUID(),
        os: String(formData.get("os") ?? "") || null,
        projectId,
        reproductionSteps,
        route: String(formData.get("route") ?? ""),
        severity,
        title: String(formData.get("title") ?? ""),
      });
      if (result.ok === false) {
        setMessage(result.error.message);
      } else {
        setOpen(false);
        router.push(`/bugs/${result.data.id}`, {
          transitionTypes: ["nav-forward"],
        });
      }
    } catch {
      setMessage("The bug report could not be submitted. Please try again.");
    }
    setBusy(false);
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button disabled={projects.length === 0}>
          <Bug aria-hidden="true" size={16} />
          Report bug
        </Button>
      </DialogTrigger>
      <DialogContent className="workspace-app bug-report-dialog">
        <DialogHeader>
          <DialogTitle>Report a bug</DialogTitle>
          <DialogDescription>
            Capture where you found the issue and how another person can
            reproduce it.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="bug-report-form">
          <div className="bug-form-grid">
            <div className="bug-form-field bug-form-wide">
              <Label htmlFor="bug-title">Title</Label>
              <Input
                autoFocus
                id="bug-title"
                maxLength={300}
                name="title"
                required
              />
            </div>
            <div className="bug-form-field">
              <Label htmlFor="bug-project">Project</Label>
              <Select onValueChange={setProjectId} value={projectId}>
                <SelectTrigger
                  aria-label="Project"
                  className="w-full"
                  id="bug-project"
                >
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.key} · {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bug-form-field">
              <Label htmlFor="bug-severity">Severity</Label>
              <Select onValueChange={setSeverity} value={severity}>
                <SelectTrigger
                  aria-label="Severity"
                  className="w-full"
                  id="bug-severity"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blocker">Blocker</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="trivial">Trivial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bug-form-field">
              <Label htmlFor="bug-environment">Environment</Label>
              <Select onValueChange={setEnvironment} value={environment}>
                <SelectTrigger
                  aria-label="Environment"
                  className="w-full"
                  id="bug-environment"
                >
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
              <Label htmlFor="bug-source">Found by</Label>
              <Select
                onValueChange={setDiscoverySource}
                value={discoverySource}
              >
                <SelectTrigger
                  aria-label="Found by"
                  className="w-full"
                  id="bug-source"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee_report">
                    Employee report
                  </SelectItem>
                  <SelectItem value="internal_qa">Internal QA</SelectItem>
                  <SelectItem value="customer_report">
                    Customer report
                  </SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="automated_test">Automated test</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bug-form-field">
              <Label htmlFor="bug-component">Page or component</Label>
              <Input
                id="bug-component"
                maxLength={500}
                name="component"
                required
              />
            </div>
            <div className="bug-form-field">
              <Label htmlFor="bug-route">URL or route</Label>
              <Input
                id="bug-route"
                maxLength={500}
                name="route"
                placeholder="/projects/…"
                required
              />
            </div>
            <div className="bug-form-field bug-form-wide bug-similar-search">
              <Button
                disabled={searchingSimilar}
                onClick={findSimilarBugs}
                type="button"
                variant="outline"
              >
                {searchingSimilar ? (
                  <SpinnerGap
                    aria-hidden="true"
                    className="animate-spin"
                    size={15}
                  />
                ) : null}
                Find earlier reports
              </Button>
              <SimilarBugResults bugs={similarBugs} />
            </div>
            <BugReproductionFields />
            <BugEnvironmentFields />
          </div>
          {message ? (
            <p className="bug-form-error" role="alert">
              {message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={busy || !projectId} type="submit">
              {busy ? (
                <SpinnerGap
                  aria-hidden="true"
                  className="animate-spin"
                  size={16}
                />
              ) : null}
              Submit report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
