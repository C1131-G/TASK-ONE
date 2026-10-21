import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import { parseEmailEnv } from "../../src/server/core/env";
import {
  makeMailTransport,
  mailConfigFromEnv,
} from "../../src/server/email/mail-transport";

const message = {
  headers: { "List-Unsubscribe": "<https://example.com/u>" },
  html: "<p>Hello</p>",
  subject: "Hello",
  text: "Hello",
  to: "asha@example.com",
} as const;

describe("mail transport", () => {
  it("logs instead of sending when SMTP is not configured", async () => {
    const config = mailConfigFromEnv(parseEmailEnv({}));
    const transport = makeMailTransport(config);

    expect(config).toBeNull();
    expect(await Effect.runPromise(transport.send(message))).toBe("logged");
  });

  it("hands the message to SMTP with the configured sender", async () => {
    const sent: unknown[] = [];
    const config = mailConfigFromEnv(
      parseEmailEnv({
        EMAIL_FROM: "Metsys <no-reply@example.com>",
        SMTP_HOST: "smtp.example.com",
        SMTP_PASSWORD: "secret-password",
        SMTP_USER: "mailer",
      })
    );
    const transport = makeMailTransport(config, (options) => {
      sent.push(options);
      return Promise.resolve();
    });

    expect(config).toMatchObject({ port: 587, secure: false });
    expect(await Effect.runPromise(transport.send(message))).toBe("sent");
    expect(sent).toEqual([
      {
        from: "Metsys <no-reply@example.com>",
        headers: message.headers,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to,
      },
    ]);
  });

  it("uses implicit TLS on port 465", () => {
    const config = mailConfigFromEnv(
      parseEmailEnv({
        EMAIL_FROM: "no-reply@example.com",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "465",
      })
    );

    expect(config?.secure).toBe(true);
  });

  it("fails with a generic unavailable error when SMTP rejects", async () => {
    const config = mailConfigFromEnv(
      parseEmailEnv({
        EMAIL_FROM: "no-reply@example.com",
        SMTP_HOST: "smtp.example.com",
      })
    );
    const transport = makeMailTransport(config, () =>
      Promise.reject(new Error("550 secret server detail"))
    );

    const error = await Effect.runPromise(Effect.flip(transport.send(message)));

    expect(error.code).toBe("UNAVAILABLE");
    expect(error.message).not.toContain("secret server detail");
  });
});
