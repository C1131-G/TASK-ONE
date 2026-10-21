import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

import type { ResolvedAddress } from "./webhook-url-guard";

export interface PinnedPost extends ResolvedAddress {
  readonly url: URL;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
}

export interface PinnedResponse {
  readonly status: number;
  readonly bodySnippet: string;
}

const DEFAULT_PORTS = { "http:": 80, "https:": 443 } as const;

/**
 * Sends one POST to an address that was already checked, never to whatever
 * the hostname resolves to now. The hostname still drives the Host header and
 * TLS certificate check. Redirects are returned, not followed.
 */
export const postToAddress = ({
  address,
  body,
  headers,
  maxResponseBytes,
  timeoutMs,
  url,
}: PinnedPost): Promise<PinnedResponse> =>
  // oxlint-disable-next-line promise/avoid-new -- node:http reports through events, so the request is wrapped once here.
  new Promise((resolve, reject) => {
    const secure = url.protocol === "https:";
    const hostname = url.hostname.replaceAll(/^\[|\]$/gu, "");
    const send = secure ? httpsRequest : httpRequest;
    const outgoing = send({
      agent: false,
      headers: {
        ...headers,
        "content-length": String(Buffer.byteLength(body)),
        host: url.host,
      },
      host: address,
      method: "POST",
      path: `${url.pathname}${url.search}`,
      port: url.port
        ? Number(url.port)
        : DEFAULT_PORTS[secure ? "https:" : "http:"],
      ...(secure && isIP(hostname) === 0 ? { servername: hostname } : {}),
    });
    const deadline = setTimeout(() => {
      outgoing.destroy(new Error("The webhook request timed out."));
    }, timeoutMs);
    outgoing.on("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    outgoing.on("response", (response) => {
      const chunks: Buffer[] = [];
      let received = 0;
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(deadline);
        resolve({
          bodySnippet: Buffer.concat(chunks)
            .subarray(0, maxResponseBytes)
            .toString("utf-8"),
          status: response.statusCode ?? 0,
        });
      };
      response.on("data", (chunk: Buffer) => {
        received += chunk.length;
        chunks.push(chunk);
        if (received >= maxResponseBytes) {
          finish();
          response.destroy();
        }
      });
      response.on("end", finish);
      response.on("error", finish);
      response.on("close", finish);
    });
    outgoing.end(body);
  });
