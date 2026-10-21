// Dependency-free so the settings form can share the rule with the server.

// Email is opt-in per event, and only these events can be emailed.
export const EMAIL_EVENT_TYPES = [
  "mention",
  "assignment",
  "comment",
  "status",
] as const;
export type EmailEventType = (typeof EMAIL_EVENT_TYPES)[number];

export const isEmailEventType = (value: string): value is EmailEventType =>
  EMAIL_EVENT_TYPES.some((eventType) => eventType === value);

export const EMAIL_CHANNEL = "email";
