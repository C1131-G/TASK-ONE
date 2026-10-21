/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

// Holds the space of an admin-only header button while its role loads, so the
// heading row does not shift when the button appears.
const HeaderActionPlaceholder = ({ label }: { readonly label: string }) => (
  <span
    aria-hidden="true"
    className="btn btn-primary btn-sm pointer-events-none opacity-0"
    inert
  >
    {label}
  </span>
);

export { HeaderActionPlaceholder };
