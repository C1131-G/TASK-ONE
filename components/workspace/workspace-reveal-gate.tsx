"use client";

import { useEffect } from "react";

// Long enough for the last staggered region to finish fading in.
const REVEAL_WINDOW_MS = 1000;

// The page-load reveal plays on first paint only. Once its window passes, the
// document is marked so pages mounted by later navigations render solid.
export const WorkspaceRevealGate = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.documentElement.dataset["workspaceRevealed"] = "";
    }, REVEAL_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
};
