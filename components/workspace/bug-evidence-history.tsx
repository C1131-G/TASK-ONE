"use client";

/* eslint-disable shadcn/no-unknown-classes -- These workspace classes are authored in workspace-reference.css. */

import { ArrowSquareOut } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import type { BugHistorySchema } from "@/src/server/work/bug-history";

type BugHistory = typeof BugHistorySchema.Type;
type EvidenceFile = NonNullable<BugHistory["evidence"][number]["file"]>;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const BugEvidenceResource = ({
  externalUrl,
  file,
  openFile,
}: {
  readonly externalUrl: string | null;
  readonly file: EvidenceFile | null;
  readonly openFile: (id: string, preview: boolean) => Promise<void>;
}) => {
  if (externalUrl) {
    return (
      <a href={externalUrl} rel="noopener noreferrer" target="_blank">
        Open evidence <ArrowSquareOut aria-hidden="true" size={13} />
      </a>
    );
  }
  if (!file) {
    return <small>File unavailable</small>;
  }
  return (
    <div className="bug-evidence-actions">
      <Button
        onClick={() => openFile(file.id, true)}
        size="sm"
        variant="outline"
      >
        Preview {file.name}
      </Button>
      <Button
        onClick={() => openFile(file.id, false)}
        size="sm"
        variant="outline"
      >
        Download
      </Button>
    </div>
  );
};

export const BugEvidenceHistory = ({
  history,
  openFile,
}: {
  readonly history: BugHistory;
  readonly openFile: (id: string, preview: boolean) => Promise<void>;
}) => {
  const itemsByKind = new Map<string, BugHistory["evidence"][number][]>();
  for (const item of history.evidence) {
    const items = itemsByKind.get(item.kind) ?? [];
    items.push(item);
    itemsByKind.set(item.kind, items);
  }

  return (
    <div className="bug-evidence-columns">
      {["before", "after", "other"].map((kind) => (
        <div className="bug-evidence-column" key={kind}>
          <h3>{kind}</h3>
          {(itemsByKind.get(kind) ?? []).map((item) => {
            const { file } = item;
            return (
              <article className="bug-evidence-item" key={item.id}>
                <p>{item.caption}</p>
                <small>{dateFormatter.format(new Date(item.createdAt))}</small>
                <BugEvidenceResource
                  externalUrl={item.externalUrl}
                  file={file}
                  openFile={openFile}
                />
              </article>
            );
          })}
        </div>
      ))}
    </div>
  );
};
