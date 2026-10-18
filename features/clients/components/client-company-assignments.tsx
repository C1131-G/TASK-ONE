/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  setClientCompanyHandlersAction,
  setClientCompanyProjectsAction,
} from "@/features/clients/clients-actions";
import type { VersionSink } from "@/features/clients/components/client-company-forms";
import type { ClientCompanyDetail } from "@/src/server/clients/client-company-contracts";

import { AssignmentDialog } from "./client-assignment-dialog";

const ClientCompanyProjects = ({
  companyId,
  onVersion,
  projectOptions,
  projects,
  version,
}: {
  readonly companyId: string;
  readonly onVersion: VersionSink;
  readonly projectOptions: readonly {
    readonly id: string;
    readonly key: string;
    readonly name: string;
  }[];
  readonly projects: ClientCompanyDetail["projects"];
  readonly version: number;
}) => (
  <section
    aria-labelledby="client-projects-heading"
    className="panel clients-panel"
  >
    <div className="panel-h clients-panel-h">
      <div>
        <h2 id="client-projects-heading">Projects</h2>
        <p className="muted">Client users can report bugs on these projects.</p>
      </div>
      <AssignmentDialog
        description="Choose the active projects this company can report bugs on."
        emptyMessage="There are no active projects."
        idPrefix={`client-${companyId}-project`}
        note="Removing a project only stops new reports. Bugs already reported on it stay visible to the client."
        onSave={(projectIds) =>
          setClientCompanyProjectsAction({
            companyId,
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
            projectIds,
          })
        }
        onVersion={onVersion}
        options={projectOptions.map((project) => ({
          detail: project.key,
          id: project.id,
          label: project.name,
        }))}
        searchLabel="Search projects"
        selectedIds={projects.map(({ id }) => id)}
        title="Manage projects"
      />
    </div>
    {projects.length ? (
      <ul className="clients-list">
        {projects.map((project) => (
          <li className="clients-list-row" key={project.id}>
            <Link
              className="clients-list-link"
              href={`/projects/${project.id}`}
            >
              <span className="mono clients-key">{project.key}</span>
              <strong>{project.name}</strong>
            </Link>
            {project.archived ? (
              <Badge variant="outline">Archived</Badge>
            ) : null}
          </li>
        ))}
      </ul>
    ) : (
      <div className="panel-b muted">
        No projects yet. Client users cannot report bugs until a project is
        linked.
      </div>
    )}
  </section>
);

const ClientCompanyHandlers = ({
  companyId,
  employeeOptions,
  handlers,
  onVersion,
  version,
}: {
  readonly companyId: string;
  readonly employeeOptions: readonly {
    readonly email: string;
    readonly id: string;
    readonly name: string;
  }[];
  readonly handlers: ClientCompanyDetail["handlers"];
  readonly onVersion: VersionSink;
  readonly version: number;
}) => (
  <section
    aria-labelledby="client-handlers-heading"
    className="panel clients-panel"
  >
    <div className="panel-h clients-panel-h">
      <div>
        <h2 id="client-handlers-heading">Handlers</h2>
        <p className="muted">
          Employees who handle this company&apos;s bug reports.
        </p>
      </div>
      <AssignmentDialog
        description="Choose the employees who handle this company's bug reports."
        emptyMessage="There are no active employees."
        idPrefix={`client-${companyId}-handler`}
        note="Removing a handler flags their open bugs from this company for reassignment."
        onSave={(employeeIds) =>
          setClientCompanyHandlersAction({
            companyId,
            employeeIds,
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
          })
        }
        onVersion={onVersion}
        options={employeeOptions.map((employee) => ({
          detail: employee.email,
          id: employee.id,
          label: employee.name,
        }))}
        searchLabel="Search employees"
        selectedIds={handlers.map(({ id }) => id)}
        title="Manage handlers"
      />
    </div>
    {handlers.length ? (
      <ul className="clients-list">
        {handlers.map((handler) => (
          <li className="clients-list-row" key={handler.id}>
            <Link className="clients-list-link" href={`/members/${handler.id}`}>
              <span aria-hidden="true" className="av">
                {handler.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="clients-person">
                <strong>{handler.name}</strong>
                <span>{handler.email}</span>
              </span>
            </Link>
            {handler.active ? null : (
              <Badge variant="outline">Deactivated</Badge>
            )}
          </li>
        ))}
      </ul>
    ) : (
      <div className="panel-b muted">
        No handlers yet. Assign employees to triage this company&apos;s bugs.
      </div>
    )}
  </section>
);

export { ClientCompanyHandlers, ClientCompanyProjects };
