import { describe, expect, it } from "bun:test";

import {
  findMentionQuery,
  insertMention,
  mentionSegments,
  mentionToken,
} from "../../features/tasks/task-mentions";

const ada = "11111111-1111-4111-8111-111111111111";

describe("comment mentions", () => {
  it("finds the open @query before the caret only at a word start", () => {
    expect(findMentionQuery("hi @ad", 6)).toEqual({ query: "ad", start: 3 });
    expect(findMentionQuery("@", 1)).toEqual({ query: "", start: 0 });
    expect(findMentionQuery("mail me@ada", 11)).toBeNull();
    expect(findMentionQuery(`done ${mentionToken(ada)} now`, 30)).toBeNull();
  });

  it("replaces the open query with a token and a trailing space", () => {
    const next = insertMention("hi @ad", 3, 6, ada);
    expect(next.value).toBe(`hi ${mentionToken(ada)} `);
    expect(next.caret).toBe(next.value.length);
  });

  it("shows names for known IDs and a generic label for unknown ones", () => {
    const segments = mentionSegments(
      `Ping ${mentionToken(ada)} and ${mentionToken("22222222-2222-4222-8222-222222222222")}`,
      new Map([[ada, "Ada Lovelace"]])
    );
    expect(segments).toEqual([
      { kind: "text", text: "Ping " },
      { kind: "mention", name: "Ada Lovelace" },
      { kind: "text", text: " and " },
      { kind: "mention", name: "employee" },
    ]);
  });
});
