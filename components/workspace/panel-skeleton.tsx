/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

// Stable keys for placeholder rows; rows never reorder.
const ROW_KEYS = ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"] as const;

const PanelSkeleton = ({
  label,
  rows = 4,
  title,
}: {
  readonly label: string;
  readonly rows?: number;
  readonly title?: string;
}) => (
  <section aria-busy="true" aria-label={label} className="panel">
    {title ? (
      <div className="panel-h">
        <h2>{title}</h2>
      </div>
    ) : null}
    <div className="panel-b skeleton-rows">
      <output className="sr-only">{label}</output>
      {ROW_KEYS.slice(0, rows).map((key) => (
        <span aria-hidden="true" className="sk skeleton-row" key={key} />
      ))}
    </div>
  </section>
);

export { PanelSkeleton };
