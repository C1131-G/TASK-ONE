/* eslint-disable shadcn/no-unknown-classes */

"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceCombobox } from "@/components/workspace/workspace-combobox";
import {
  formatActivityGroup,
  formatActivityTime,
  getActivityVerb,
  groupActivityEntries,
} from "@/src/lib/activity-display";
import type { ActivityEntry } from "@/src/server/activity/activity-management";

type ActivityFilter = "all" | "status" | "comments" | "projects";
const ACTIVITY_FILTERS: readonly ActivityFilter[] = [
  "all",
  "status",
  "comments",
  "projects",
];

const isStatusChange = (action: string) =>
  action === "task.status_changed" ||
  action === "task.complete" ||
  action === "task.completion_undone";

const getActivityKind = (entry: ActivityEntry): ActivityFilter | "other" => {
  if (entry.action.startsWith("comment.")) {
    return "comments";
  }
  if (entry.action.startsWith("project.")) {
    return "projects";
  }
  if (isStatusChange(entry.action)) {
    return "status";
  }
  return "other";
};

const ActivityFeedList = ({
  entries,
}: {
  readonly entries: readonly ActivityEntry[];
}) => {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [actorId, setActorId] = useState("everyone");
  const people = useMemo(
    () =>
      [...new Map(entries.map((entry) => [entry.actorId, entry.actorName]))]
        .map(([id, name]) => ({ id, name }))
        .toSorted((left, right) => left.name.localeCompare(right.name)),
    [entries]
  );
  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const matchesFilter =
          filter === "all" || getActivityKind(entry) === filter;
        const matchesActor =
          actorId === "everyone" || entry.actorId === actorId;
        return matchesFilter && matchesActor;
      }),
    [actorId, entries, filter]
  );
  const groups = useMemo(
    () => groupActivityEntries(visibleEntries),
    [visibleEntries]
  );

  return (
    <section aria-label="Workspace activity" className="stack">
      <div className="row activity-filters">
        <Tabs
          onValueChange={(value) => {
            const selectedFilter = ACTIVITY_FILTERS.find(
              (candidate) => candidate === value
            );
            if (selectedFilter) {
              setFilter(selectedFilter);
            }
          }}
          value={filter}
        >
          <div className="activity-tabs">
            <TabsList aria-label="Filter activity">
              <TabsTrigger aria-controls={undefined} value="all">
                All
              </TabsTrigger>
              <TabsTrigger aria-controls={undefined} value="status">
                Status changes
              </TabsTrigger>
              <TabsTrigger aria-controls={undefined} value="comments">
                Comments
              </TabsTrigger>
              <TabsTrigger aria-controls={undefined} value="projects">
                Projects
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
        <label className="sr" htmlFor="activity-person">
          Filter activity by person
        </label>
        <WorkspaceCombobox
          ariaLabel="Filter by person"
          className="min-w-[130px]"
          emptyMessage="No people found."
          id="activity-person"
          onValueChange={setActorId}
          options={[
            { label: "Everyone", value: "everyone" },
            ...people.map((person) => ({
              label: person.name,
              value: person.id,
            })),
          ]}
          placeholder="Everyone"
          searchPlaceholder="Search people"
          value={actorId}
        />
      </div>

      {groups.length ? (
        groups.map(([group, groupEntries]) => (
          <section
            aria-labelledby={`activity-${group}`}
            className="panel"
            key={group}
          >
            <div className="panel-h">
              <h2 id={`activity-${group}`}>{formatActivityGroup(group)}</h2>
            </div>
            <div className="panel-b feed lined">
              {groupEntries.map((entry) => {
                const linkedName = entry.taskTitle ?? entry.projectName;
                const href = entry.projectId
                  ? (`/projects/${entry.projectId}` as Route)
                  : null;
                let titleNode = null;
                if (linkedName && href) {
                  titleNode = (
                    <Link className="activity-link" href={href}>
                      {linkedName}
                    </Link>
                  );
                } else if (linkedName) {
                  titleNode = <strong>{linkedName}</strong>;
                }

                return (
                  <article className="row activity-entry" key={entry.id}>
                    <span aria-hidden="true" className="av">
                      {entry.actorName.slice(0, 1).toUpperCase()}
                    </span>
                    <p className="activity-copy grow">
                      <strong>{entry.actorName}</strong>{" "}
                      {getActivityVerb(entry.action)} {titleNode}
                      {entry.taskTitle && entry.projectName ? (
                        <>
                          {" "}
                          in{" "}
                          <Link
                            className="activity-project"
                            href={href as Route}
                          >
                            {entry.projectName}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    <time
                      className="faint"
                      dateTime={entry.createdAt}
                      title={new Date(entry.createdAt).toLocaleString()}
                    >
                      {formatActivityTime(entry.createdAt)}
                    </time>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <section className="panel panel-b">
          <h2>No matching activity</h2>
          <p className="muted">Try another activity filter or person.</p>
        </section>
      )}
    </section>
  );
};

export { ActivityFeedList };
