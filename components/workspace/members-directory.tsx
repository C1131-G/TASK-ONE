/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Check, Minus } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import { EmployeeAdminControls } from "@/components/workspace/employee-admin-controls";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";

type MemberRole = "all" | "admin" | "employee";

const ROLE_PERMISSIONS = [
  { admin: true, employee: true, label: "View company projects and tasks" },
  { admin: true, employee: true, label: "Create tasks" },
  {
    admin: true,
    employee: true,
    label: "Edit tasks they created or are assigned to",
  },
  { admin: true, employee: true, label: "Comment on visible active tasks" },
  { admin: true, employee: true, label: "Manage personal views and favorites" },
  {
    admin: true,
    employee: false,
    label: "Manage projects, milestones, and memberships",
  },
  {
    admin: true,
    employee: false,
    label: "Manage employees, teams, and company settings",
  },
  {
    admin: true,
    employee: false,
    label: "Manage calendar events and project files",
  },
  {
    admin: true,
    employee: false,
    label: "Archive and restore projects and tasks",
  },
] as const;

const PermissionValue = ({
  allowed,
  roleLabel,
}: {
  readonly allowed: boolean;
  readonly roleLabel: "Admin" | "Employee";
}) => (
  <span
    aria-label={`${roleLabel}: ${allowed ? "allowed" : "not allowed"}`}
    className={allowed ? "permission-allowed" : "permission-denied"}
  >
    {allowed ? (
      <Check aria-hidden="true" size={16} weight="bold" />
    ) : (
      <Minus aria-hidden="true" size={16} />
    )}
  </span>
);

const RolePermissions = () => (
  <section aria-label="Roles and permissions" className="panel members-panel">
    <div className="panel-h">
      <h2>Roles &amp; permissions</h2>
      <p>Permissions are enforced on every server request.</p>
    </div>
    <Table className="members-permissions-table">
      <TableCaption className="sr-only">Role permissions</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Permission</TableHead>
          <TableHead>Employee</TableHead>
          <TableHead>Admin</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROLE_PERMISSIONS.map(({ admin, employee, label }) => (
          <TableRow key={label}>
            <TableRowHeader>{label}</TableRowHeader>
            <TableCell>
              <PermissionValue allowed={employee} roleLabel="Employee" />
            </TableCell>
            <TableCell>
              <PermissionValue allowed={admin} roleLabel="Admin" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </section>
);

const MembersDirectory = ({
  canManageMembers,
  employees,
  section,
  teams,
}: {
  readonly canManageMembers: boolean;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly section: "members" | "roles";
  readonly teams: readonly { readonly id: string; readonly name: string }[];
}) => {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<MemberRole>("all");
  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return employees.filter((employee) => {
      const matchesQuery =
        !query ||
        [employee.name, employee.email, employee.jobTitle, employee.teamName]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase().includes(query));
      const matchesRole = role === "all" || employee.role === role;
      return matchesQuery && matchesRole;
    });
  }, [employees, role, search]);

  return (
    <div className="members-workspace">
      <nav aria-label="People" className="members-section-nav">
        <Link
          aria-current={section === "members" ? "page" : undefined}
          href="/members"
        >
          Members
        </Link>
        <Link href="/teams">Teams</Link>
        <Link
          aria-current={section === "roles" ? "page" : undefined}
          href="/members?section=roles"
        >
          Roles &amp; permissions
        </Link>
      </nav>
      {section === "roles" ? (
        <RolePermissions />
      ) : (
        <section aria-label="Workspace members" className="panel members-panel">
          <div className="panel-h members-toolbar">
            <span className="ct">{filteredEmployees.length} members</span>
            <div className="members-controls">
              <Input
                aria-label="Search members"
                className="members-search"
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search members"
                type="search"
                value={search}
              />
              <div
                aria-label="Filter members by role"
                className="members-role-filter"
              >
                {(
                  [
                    ["all", "All"],
                    ["admin", "Admin"],
                    ["employee", "Employee"],
                  ] as const
                ).map(([value, label]) => (
                  <WorkspaceButton
                    active={role === value}
                    aria-pressed={role === value}
                    key={value}
                    onClick={() => setRole(value)}
                    size="sm"
                    type="button"
                    variant="ghost"
                    workspace
                  >
                    {label}
                  </WorkspaceButton>
                ))}
              </div>
            </div>
          </div>
          {filteredEmployees.length ? (
            <Table className="members-table">
              <TableCaption className="sr-only">Workspace members</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Active projects</TableHead>
                  <TableHead>Open tasks</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageMembers ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Link
                        className="members-person members-person-link"
                        href={`/members/${employee.id}` as Route}
                      >
                        <Avatar className="members-avatar">
                          {employee.avatar ? (
                            <AvatarImage alt="" src={employee.avatar} />
                          ) : null}
                          <AvatarFallback>
                            {employee.name.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="members-person-copy">
                          <strong>{employee.name}</strong>
                          <span>{employee.email}</span>
                          {employee.jobTitle ? (
                            <span>{employee.jobTitle}</span>
                          ) : null}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="ct">
                        {employee.role === "admin" ? "Admin" : "Employee"}
                      </span>
                    </TableCell>
                    <TableCell>{employee.teamName ?? "No team"}</TableCell>
                    <TableCell>{employee.activeProjectCount}</TableCell>
                    <TableCell>{employee.openAssignedTaskCount}</TableCell>
                    <TableCell className="mono">
                      {employee.employeeId}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          employee.mustChangePassword ? "outline" : "secondary"
                        }
                      >
                        {employee.mustChangePassword
                          ? "Setup required"
                          : "Active"}
                      </Badge>
                    </TableCell>
                    {canManageMembers ? (
                      <TableCell>
                        <EmployeeAdminControls
                          employee={employee}
                          teams={teams}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="members-empty panel-b muted">
              {search || role !== "all"
                ? "No members match these filters."
                : "No members found."}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export { MembersDirectory };
