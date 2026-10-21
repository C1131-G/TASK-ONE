import { Context, Effect, Layer } from "effect";
import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { AppError } from "../core/action-result";
import { parseEmailEnv } from "../core/env";
import type { EmailEnv } from "../core/env";
import { logger } from "../core/logger";

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface MailTransportApi {
  /** "logged" means no SMTP server is configured, so nothing left the server. */
  readonly send: (
    message: MailMessage
  ) => Effect.Effect<"sent" | "logged", AppError>;
}

export class MailTransport extends Context.Service<
  MailTransport,
  MailTransportApi
>()("metsys/server/MailTransport") {}

export interface MailConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly from: string;
  readonly auth: { readonly user: string; readonly pass: string } | null;
}

export interface SmtpEnvelope extends MailMessage {
  readonly from: string;
}

type SendMail = (envelope: SmtpEnvelope) => Promise<unknown>;

const DEFAULT_SMTP_PORT = 587;
const IMPLICIT_TLS_PORT = 465;

export const mailConfigFromEnv = (env: EmailEnv): MailConfig | null => {
  if (env.SMTP_HOST === undefined || env.EMAIL_FROM === undefined) {
    return null;
  }
  const port = env.SMTP_PORT ?? DEFAULT_SMTP_PORT;
  return {
    auth:
      env.SMTP_USER !== undefined && env.SMTP_PASSWORD !== undefined
        ? { pass: env.SMTP_PASSWORD, user: env.SMTP_USER }
        : null,
    from: env.EMAIL_FROM,
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE
      ? env.SMTP_SECURE === "true"
      : port === IMPLICIT_TLS_PORT,
  };
};

const smtpSender = (config: MailConfig): SendMail => {
  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.auth ? { auth: config.auth } : {}),
  };
  const transporter = createTransport(options);
  return (envelope) => transporter.sendMail(envelope);
};

const unavailable = () =>
  new AppError({
    code: "UNAVAILABLE",
    message: "The email provider could not accept the message.",
  });

export const makeMailTransport = (
  config: MailConfig | null,
  sendMail: SendMail | null = config ? smtpSender(config) : null
): MailTransportApi => ({
  send: (message) => {
    if (!config || !sendMail) {
      // Development and tests: record that a send happened, never the address.
      logger.info("email not sent: SMTP is not configured", {
        subject: message.subject,
      });
      return Effect.succeed("logged" as const);
    }
    return Effect.tryPromise({
      catch: unavailable,
      try: () => sendMail({ ...message, from: config.from }),
    }).pipe(Effect.as("sent" as const));
  },
});

export const MailTransportLive = Layer.sync(MailTransport, () =>
  MailTransport.of(makeMailTransport(mailConfigFromEnv(parseEmailEnv())))
);
