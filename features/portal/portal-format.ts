import type { ClientStatusLabel } from "./client-status";

export type PortalImpact = "low" | "medium" | "high" | "urgent";

export const portalImpacts = ["low", "medium", "high", "urgent"] as const;

export const impactText: Record<PortalImpact, string> = {
  high: "High",
  low: "Low",
  medium: "Medium",
  urgent: "Urgent",
};

export const impactHint: Record<PortalImpact, string> = {
  high: "A key feature is broken and there is no easy workaround.",
  low: "A small annoyance or cosmetic issue. Work carries on as normal.",
  medium: "Something is not working, but there is a workaround.",
  urgent: "Work is blocked for you or your customers right now.",
};

type BadgeTone = "accent" | "amber" | "gray" | "green" | "violet";

export const statusTone: Record<ClientStatusLabel, BadgeTone> = {
  acknowledged: "violet",
  closed: "green",
  fix_ready: "accent",
  in_progress: "amber",
  merged: "gray",
  not_a_bug: "gray",
  submitted: "gray",
  waiting_for_reply: "amber",
  withdrawn: "gray",
};

export const isPortalImpact = (value: string): value is PortalImpact =>
  portalImpacts.some((impact) => impact === value);
