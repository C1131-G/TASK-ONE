import type { ReactNode } from "react";
import { ViewTransition } from "react";

// Cross-fades content when an in-page view switch (a `?view=` tab) commits.
// The page itself stays mounted, so keying by the view remounts only this
// boundary, and the stable `name` pairs the outgoing and incoming content.
// `name` must be unique on the page.
export const ViewSwitchTransition = ({
  children,
  name,
  view,
}: {
  readonly children: ReactNode;
  readonly name: string;
  readonly view: string;
}) => (
  <ViewTransition default="none" key={view} name={name} share="nav-fade">
    {children}
  </ViewTransition>
);
