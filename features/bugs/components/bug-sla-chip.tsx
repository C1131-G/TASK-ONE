/* eslint-disable shadcn/no-unknown-classes -- Bug list styles are defined in app/workspace-styles. */

import { slaChipModel } from "@/features/bugs/bug-sla-format";
import type { BugListItemSchema } from "@/src/server/work/bug-management";

type Sla = (typeof BugListItemSchema.Type)["sla"];

const BugSlaChip = ({ sla }: { readonly sla: Sla }) => {
  const model = slaChipModel(sla);
  if (!model) {
    return null;
  }
  return (
    <span className={`bug-sla-chip bug-sla-${model.state}`}>
      <span aria-hidden="true">{model.label}</span>
      <span className="sr-only">{model.sentence}</span>
    </span>
  );
};

export { BugSlaChip };
