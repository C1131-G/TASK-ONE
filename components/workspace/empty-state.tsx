/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

// One empty state for every workspace list: an icon, what is missing, what to
// do about it, and the action that does it when one exists.
//   panel   – stands in for a whole page section, framed like a panel
//   section – fills a panel body
//   compact – sits in a narrow column or a short list
type EmptyStateSize = "compact" | "panel" | "section";

const EMPTY_STATE_CLASSES = {
  compact: "empty-state sm",
  panel: "panel empty-state",
  section: "empty-state",
} as const satisfies Record<EmptyStateSize, string>;

const ICON_SIZE = 22;

const EmptyState = ({
  action,
  description,
  headingLevel = 3,
  icon: IconComponent,
  size = "section",
  title,
}: {
  readonly action?: ReactNode;
  readonly description?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly icon: Icon;
  readonly size?: EmptyStateSize;
  readonly title: string;
}) => {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={EMPTY_STATE_CLASSES[size]}>
      <span aria-hidden="true" className="glyph">
        <IconComponent size={ICON_SIZE} />
      </span>
      <Heading className="es-h">{title}</Heading>
      {description ? <p>{description}</p> : null}
      {action ?? null}
    </div>
  );
};

export { EmptyState };
export type { EmptyStateSize };
