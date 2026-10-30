/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Project bug view uses reference workspace styles in apps/web/app/workspace-styles. */

import type { BugListItemSchema } from "@/src/server/work/bug-management";

import { BugList } from "./bug-list";
import { BugReportDialog } from "./bug-report-dialog";

export const ProjectBugs = ({
  bugs,
  project,
}: {
  readonly bugs: readonly (typeof BugListItemSchema.Type)[];
  readonly project: {
    readonly id: string;
    readonly key: string;
    readonly name: string;
  };
}) => (
  <section aria-labelledby="project-bugs-heading" className="project-bugs-view">
    <header className="bug-page-header">
      <div>
        <h2 id="project-bugs-heading">Project bugs</h2>
        <p className="muted">Reports and fix history for {project.name}.</p>
      </div>
      <BugReportDialog initialProjectId={project.id} projects={[project]} />
    </header>
    <BugList bugs={bugs} emptyMessage="This project has no bug reports yet." />
  </section>
);
