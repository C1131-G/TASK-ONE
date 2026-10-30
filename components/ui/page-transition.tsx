import type { ReactNode } from "react";
import { ViewTransition } from "react";

// Transition types a navigation can carry. Classes are in apps/web/app/view-transitions.css.
export type NavigationTransitionType = "nav-back" | "nav-fade" | "nav-forward";

const PAGE_TRANSITION_CLASSES = {
  default: "nav-fade",
  "nav-back": "nav-back",
  "nav-fade": "nav-fade",
  "nav-forward": "nav-forward",
} as const;

// Wrap the root of every page.tsx. It must sit in the page, not a layout:
// layouts persist across navigations, so their enter and exit never fire.
// Untyped navigations (browser back, plain links) cross-fade.
export const PageTransition = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <ViewTransition
    default="none"
    enter={PAGE_TRANSITION_CLASSES}
    exit={PAGE_TRANSITION_CLASSES}
  >
    {children}
  </ViewTransition>
);
