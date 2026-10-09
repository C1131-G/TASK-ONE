/* eslint-disable shadcn/no-unknown-classes */

"use client";

import {
  CalendarBlank,
  ChartLineUp,
  Files,
  List,
  SquaresFour,
  Table,
  Pulse,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";

const views = [
  { Icon: SquaresFour, id: "overview", label: "Overview" },
  { Icon: SquaresFour, id: "board", label: "Board" },
  { Icon: List, id: "list", label: "List" },
  { Icon: Table, id: "table", label: "Table" },
  { Icon: CalendarBlank, id: "calendar", label: "Calendar" },
  { Icon: ChartLineUp, id: "timeline", label: "Timeline" },
  { Icon: Files, id: "files", label: "Files" },
  { Icon: Pulse, id: "activity", label: "Activity" },
] as const;

export const ProjectViewTabs = ({
  projectId,
  selected,
}: {
  readonly projectId: string;
  readonly selected: string;
}) => (
  <nav aria-label="Project views" className="tabs project-tabs">
    {views.map(({ Icon, id, label }) => (
      <Link
        aria-current={selected === id ? "page" : undefined}
        className={`tab${selected === id ? " on" : ""}`}
        href={`/projects/${projectId}?view=${id}` as Route}
        key={id}
      >
        <Icon aria-hidden="true" size={14} />
        {label}
      </Link>
    ))}
  </nav>
);
