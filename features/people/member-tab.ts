type MemberTab = "assigned" | "completed";

// ?tab=completed shows finished work; anything else shows assigned work.
const parseMemberTab = (value: unknown): MemberTab =>
  value === "completed" ? "completed" : "assigned";

export { parseMemberTab };
export type { MemberTab };
