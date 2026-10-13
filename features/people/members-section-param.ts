const MEMBERS_SECTIONS = ["members", "roles"] as const;

type MembersSectionName = (typeof MEMBERS_SECTIONS)[number];

// Only ?section=roles switches tabs; anything else shows the member list.
const parseMembersSection = (value: unknown): MembersSectionName =>
  value === "roles" ? "roles" : "members";

export { parseMembersSection };
export type { MembersSectionName };
