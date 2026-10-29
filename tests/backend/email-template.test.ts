import { describe, expect, it } from "bun:test";

import {
  renderDigestEmail,
  renderNotificationEmail,
} from "../../src/server/email/email-template";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../../src/server/email/unsubscribe-token";

const SECRET = "a-test-secret-that-is-at-least-thirty-two-chars";
const BASE_URL = "https://app.example.com";

describe("unsubscribe tokens", () => {
  it("round-trips the user id", () => {
    const token = signUnsubscribeToken("user-1", SECRET);

    expect(verifyUnsubscribeToken(token, SECRET)).toBe("user-1");
  });

  it("rejects a tampered token and one signed with another secret", () => {
    const token = signUnsubscribeToken("user-1", SECRET);
    const [encodedUser, signature] = token.split(".");
    const forged = `${Buffer.from("user-2").toString("base64url")}.${signature}`;

    expect(encodedUser).not.toBe(forged.split(".")[0]);
    expect(verifyUnsubscribeToken(forged, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token, `${SECRET}-other`)).toBeNull();
    expect(verifyUnsubscribeToken("not-a-token", SECRET)).toBeNull();
  });
});

describe("notification emails", () => {
  const input = {
    baseUrl: BASE_URL,
    body: 'Fix <script>alert("x")</script>',
    recipientName: "Asha",
    secret: SECRET,
    title: "Ravi assigned you a task",
    url: "/tasks/42",
    userId: "user-1",
  } as const;

  it("links to the item and carries an unsubscribe footer in both parts", () => {
    const email = renderNotificationEmail(input);
    const unsubscribeUrl = `${BASE_URL}/api/email/unsubscribe?token=`;

    expect(email.subject).toBe("Ravi assigned you a task");
    expect(email.text).toContain(`${BASE_URL}/tasks/42`);
    expect(email.text).toContain(unsubscribeUrl);
    expect(email.html).toContain(`href="${BASE_URL}/tasks/42"`);
    expect(email.html).toContain(unsubscribeUrl);
    expect(email.headers["List-Unsubscribe"]).toStartWith(`<${unsubscribeUrl}`);
    expect(email.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click"
    );
  });

  it("escapes user-controlled text in the HTML part", () => {
    const email = renderNotificationEmail(input);

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("builds a digest listing every item with the same footer", () => {
    const email = renderDigestEmail({
      baseUrl: BASE_URL,
      items: [
        { body: "", title: "First", url: "/tasks/1" },
        { body: "Details", title: "Second", url: "/tasks/2" },
      ],
      recipientName: "Asha",
      secret: SECRET,
      userId: "user-1",
    });

    expect(email.subject).toBe("Your Taskora digest: 2 updates");
    expect(email.text).toContain("First");
    expect(email.text).toContain(`${BASE_URL}/tasks/2`);
    expect(email.html).toContain("Second");
    expect(email.headers["List-Unsubscribe"]).toContain(
      "/api/email/unsubscribe?token="
    );
  });
});
