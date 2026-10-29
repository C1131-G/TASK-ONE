import { signUnsubscribeToken } from "./unsubscribe-token";

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface DigestItem {
  readonly title: string;
  readonly body: string;
  readonly url: string;
}

interface RenderContext {
  readonly baseUrl: string;
  readonly recipientName: string;
  readonly secret: string;
  readonly userId: string;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
const HTML_SPECIAL = /["&'<>]/gu;

const escapeHtml = (value: string): string =>
  value.replaceAll(HTML_SPECIAL, (character) => HTML_ESCAPES[character] ?? "");

const absoluteUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/u, "")}${path}`;

const unsubscribeUrl = (context: RenderContext): string =>
  absoluteUrl(
    context.baseUrl,
    `/api/email/unsubscribe?token=${signUnsubscribeToken(context.userId, context.secret)}`
  );

const compose = (
  context: RenderContext,
  subject: string,
  items: readonly DigestItem[]
): RenderedEmail => {
  const unsubscribe = unsubscribeUrl(context);
  const text = [
    `Hi ${context.recipientName},`,
    "",
    ...items.flatMap((item) => [
      item.title,
      ...(item.body ? [item.body] : []),
      absoluteUrl(context.baseUrl, item.url),
      "",
    ]),
    "--",
    `You get this because of your Taskora email settings. Unsubscribe: ${unsubscribe}`,
  ].join("\n");
  const itemsHtml = items
    .map(
      (item) =>
        `<p><a href="${escapeHtml(absoluteUrl(context.baseUrl, item.url))}"><strong>${escapeHtml(item.title)}</strong></a>${item.body ? `<br>${escapeHtml(item.body)}` : ""}</p>`
    )
    .join("");
  const html = `<p>Hi ${escapeHtml(context.recipientName)},</p>${itemsHtml}<hr><p style="font-size:12px;color:#666">You get this because of your Taskora email settings. <a href="${escapeHtml(unsubscribe)}">Unsubscribe</a></p>`;
  return {
    headers: {
      "List-Unsubscribe": `<${unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    html,
    subject,
    text,
  };
};

export const renderNotificationEmail = (
  input: RenderContext & {
    readonly title: string;
    readonly body: string;
    readonly url: string;
  }
): RenderedEmail =>
  compose(input, input.title, [
    { body: input.body, title: input.title, url: input.url },
  ]);

export const renderDigestEmail = (
  input: RenderContext & { readonly items: readonly DigestItem[] }
): RenderedEmail =>
  compose(
    input,
    `Your Taskora digest: ${input.items.length} update${input.items.length === 1 ? "" : "s"}`,
    input.items
  );
