/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

const KEYS = ["a", "b", "c", "d"] as const;

const PortalListSkeleton = ({ label }: { readonly label: string }) => (
  <div aria-busy="true">
    <output className="sr-only">{label}</output>
    <span aria-hidden="true" className="sk portal-sk-title" />
    <ul aria-hidden="true" className="portal-bug-list">
      {KEYS.map((key) => (
        <li key={key}>
          <span className="sk portal-sk-card" />
        </li>
      ))}
    </ul>
  </div>
);

export { PortalListSkeleton };
