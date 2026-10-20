/* eslint-disable shadcn/no-unknown-classes -- The underline is styled in app/workspace-styles/inputs.css. */

import { ViewTransition } from "react";

// The active underline of a tab strip. Render it only inside the active tab:
// when navigation moves it to another tab, the shared `name` makes it slide
// there instead of jumping. Each strip on a page needs its own `name`, and the
// strip must not be mounted twice at once.
export const TabUnderline = ({ name }: { readonly name: string }) => (
  <ViewTransition name={name} share="indicator">
    <span aria-hidden="true" className="tab-underline" />
  </ViewTransition>
);
