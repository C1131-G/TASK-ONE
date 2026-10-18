type SettingsSection =
  | "appearance"
  | "preferences"
  | "profile"
  | "sessions"
  | "workspace"
  | "sla";

// Unknown section names open appearance, which is available to every role.
const parseSettingsSection = (value: unknown): SettingsSection =>
  value === "preferences" ||
  value === "profile" ||
  value === "sessions" ||
  value === "workspace" ||
  value === "sla"
    ? value
    : "appearance";

export { parseSettingsSection };
export type { SettingsSection };
