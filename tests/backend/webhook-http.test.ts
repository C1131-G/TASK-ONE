import { afterAll, beforeAll, expect, it } from "bun:test";
import { createServer } from "node:http";
import type { IncomingHttpHeaders, Server } from "node:http";
import type { AddressInfo } from "node:net";

import "./support/server-only-stub";
import { postToAddress } from "../../src/server/webhooks/webhook-http";

interface Seen {
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
  readonly url: string | undefined;
}

let server: Server;
let port = 0;
const seen: Seen[] = [];
const BIG_RESPONSE_BYTES = 2_000_000;

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      seen.push({
        body: Buffer.concat(chunks).toString("utf-8"),
        headers: request.headers,
        url: request.url,
      });
      if (request.url === "/redirect") {
        response.writeHead(302, { location: "/landed" });
        response.end();
      } else if (request.url === "/slow") {
        // Never answers within the test timeout.
      } else if (request.url === "/big") {
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("x".repeat(BIG_RESPONSE_BYTES));
      } else {
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("accepted");
      }
    });
  });
  // oxlint-disable-next-line promise/avoid-new -- listen() reports through a callback.
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  ({ port } = server.address() as AddressInfo);
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const send = (path: string, overrides: { timeoutMs?: number } = {}) =>
  postToAddress({
    address: "127.0.0.1",
    body: '{"ok":true}',
    family: 4,
    headers: { "content-type": "application/json", "x-test": "1" },
    maxResponseBytes: 1024,
    timeoutMs: overrides.timeoutMs ?? 2000,
    url: new URL(`http://pinned.example.test:${port}${path}`),
  });

it("connects to the pinned address and keeps the original Host header", async () => {
  const result = await send("/hook");
  expect(result).toMatchObject({ bodySnippet: "accepted", status: 200 });
  const last = seen.at(-1);
  expect(last?.headers.host).toBe(`pinned.example.test:${port}`);
  expect(last?.headers["x-test"]).toBe("1");
  expect(last?.body).toBe('{"ok":true}');
});

it("does not follow redirects", async () => {
  const before = seen.length;
  const result = await send("/redirect");
  expect(result.status).toBe(302);
  await Bun.sleep(50);
  expect(seen.slice(before).map(({ url }) => url)).toEqual(["/redirect"]);
});

it("gives up on a server that never answers", async () => {
  await expect(send("/slow", { timeoutMs: 150 })).rejects.toThrow();
});

it("caps how much of a response it reads", async () => {
  const result = await send("/big");
  expect(result.status).toBe(200);
  expect(result.bodySnippet.length).toBeLessThanOrEqual(1024);
});
