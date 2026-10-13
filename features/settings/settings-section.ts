type SettingsSection = "appearance" | "preferences";

// ?section=preferences deep-links the preferences tab; anything else opens appearance.
const parseSettingsSection = (value: unknown): SettingsSection =>
  value === "preferences" ? "preferences" : "appearance";

export { parseSettingsSection };
export type { SettingsSection };
