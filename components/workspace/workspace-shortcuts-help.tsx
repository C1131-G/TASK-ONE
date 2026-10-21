/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { useId } from "react";

import {
  getAvailableCommands,
  getPaletteToggleKeys,
} from "@/components/workspace/workspace-commands";
import type { Viewer } from "@/components/workspace/workspace-commands";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";

// Keys read aloud one by one: "G, then, H".
export const ShortcutKeys = ({
  keys,
}: {
  readonly keys: readonly string[];
}) => (
  <span className="row">
    {keys.map((key, index) => (
      <span className="row" key={key}>
        {index > 0 ? <span className="sr-only">then</span> : null}
        <kbd className="kbd">{key}</kbd>
      </span>
    ))}
  </span>
);

interface ShortcutRow {
  readonly keys: readonly string[];
  readonly label: string;
}

const ShortcutGroup = ({
  rows,
  title,
}: {
  readonly rows: readonly ShortcutRow[];
  readonly title: string;
}) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3
        className="mb-2 text-xs font-medium text-muted-foreground"
        id={headingId}
      >
        {title}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map(({ keys, label }) => (
          <li className="flex items-center justify-between gap-4" key={label}>
            <span>{label}</span>
            <ShortcutKeys keys={keys} />
          </li>
        ))}
      </ul>
    </section>
  );
};

export const WorkspaceShortcutsList = ({
  isMac,
  viewer,
}: {
  readonly isMac: boolean;
  readonly viewer: Viewer;
}) => {
  const keyed = getAvailableCommands(viewer).filter(
    ({ keys }) => keys.length > 0
  );
  const rowsFor = (group: string): ShortcutRow[] =>
    keyed.filter((command) => command.group === group);
  return (
    <div className="flex flex-col gap-5">
      <ShortcutGroup
        rows={[
          {
            keys: getPaletteToggleKeys(isMac),
            label: "Search or run a command",
          },
          ...rowsFor("Help"),
        ]}
        title="General"
      />
      <ShortcutGroup rows={rowsFor("Actions")} title="Actions" />
      <ShortcutGroup rows={rowsFor("Navigate")} title="Go to" />
    </div>
  );
};

export const WorkspaceShortcutsHelp = ({
  isMac,
  onOpenChange,
  open,
  viewer,
}: {
  readonly isMac: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly viewer: Viewer;
}) => (
  <WorkspaceModal
    description="Single-key shortcuts for the workspace. They pause while you type or a dialog is open."
    onOpenChange={onOpenChange}
    open={open}
    title="Keyboard shortcuts"
    trigger={null}
  >
    <WorkspaceShortcutsList isMac={isMac} viewer={viewer} />
  </WorkspaceModal>
);
