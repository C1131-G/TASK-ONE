import { isIP } from "node:net";

const FORWARDED_FOR_HEADER = "x-forwarded-for";
const DEFAULT_TRUSTED_IP_HEADER = FORWARDED_FOR_HEADER;
const DEFAULT_TRUSTED_PROXY_HOPS = 1;

// Better Auth keys rate limits and session IPs on this header. Only the auth
// route writes it, after discarding whatever value the client sent.
export const RESOLVED_CLIENT_IP_HEADER = "x-metsys-client-ip";

export interface ClientIpConfig {
  // Header the trusted reverse proxy sets, such as x-real-ip,
  // cf-connecting-ip, or x-forwarded-for.
  readonly header: string;
  // For x-forwarded-for only: how many trusted proxies append to the chain.
  // The client address is the entry this many places from the right.
  readonly proxyHops: number;
}

export const readClientIpConfig = (
  env: Readonly<Record<string, string | undefined>>
): ClientIpConfig => {
  const header =
    env["TRUSTED_IP_HEADER"]?.trim().toLowerCase() || DEFAULT_TRUSTED_IP_HEADER;
  const rawHops = env["TRUSTED_PROXY_HOPS"]?.trim();
  const proxyHops = rawHops ? Number(rawHops) : DEFAULT_TRUSTED_PROXY_HOPS;
  if (!Number.isInteger(proxyHops) || proxyHops < 1) {
    throw new Error("TRUSTED_PROXY_HOPS must be a positive integer.");
  }
  return { header, proxyHops };
};

const clientIpConfig = readClientIpConfig(process.env);

// The left-most forwarded entries come from the client and can be anything;
// only the entries appended by our own proxies are trustworthy.
const pickForwardedEntry = (
  value: string,
  proxyHops: number
): string | undefined => {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.at(-proxyHops);
};

// The client address as reported by the trusted proxy, or undefined when the
// header is missing or does not hold a valid IP address.
export const resolveClientIp = (
  headers: Headers | null | undefined,
  config: ClientIpConfig = clientIpConfig
): string | undefined => {
  const value = headers?.get(config.header);
  if (!value) {
    return undefined;
  }
  const candidate =
    config.header === FORWARDED_FOR_HEADER
      ? pickForwardedEntry(value, config.proxyHops)
      : value.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : undefined;
};

// Copies the request with the resolved client IP in the header Better Auth
// reads, so a client-supplied value can never reach the rate limiter.
export const withResolvedClientIp = (
  request: Request,
  config: ClientIpConfig = clientIpConfig
): Request => {
  // Edit the copy's own headers: Bun keeps the original headers when the
  // init passes a Headers object that ended up without the deleted entry.
  const copy = new Request(request);
  copy.headers.delete(RESOLVED_CLIENT_IP_HEADER);
  const ip = resolveClientIp(request.headers, config);
  if (ip) {
    copy.headers.set(RESOLVED_CLIENT_IP_HEADER, ip);
  }
  return copy;
};
