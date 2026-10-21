import { isIP } from "node:net";

import { AppError } from "../core/action-result";

// Everything a webhook may reach is decided here. The URL is checked when an
// admin saves it, and the resolved address is checked again before every
// delivery; the connection is then pinned to that checked address so a DNS
// answer that changes between check and connect cannot redirect the request.

export interface ResolvedAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

export type HostResolver = (
  hostname: string
) => Promise<readonly ResolvedAddress[]>;

const refuse = (message: string): never => {
  throw new AppError({ code: "VALIDATION_FAILED", field: "url", message });
};

const BYTE_RANGE = 256;
const IPV4_OCTETS = 4;
const IPV4_BITS = 32;
const IPV6_GROUPS = 8;
const HEX_RADIX = 16;
const MAX_GROUP = 0xff_ff;
const DECIMAL_OCTET = /^\d{1,3}$/u;

const parseIpv4 = (text: string): readonly number[] | undefined => {
  const parts = text.split(".");
  if (
    parts.length !== IPV4_OCTETS ||
    !parts.every((part) => DECIMAL_OCTET.test(part))
  ) {
    return undefined;
  }
  const octets = parts.map(Number);
  return octets.every((octet) => octet < BYTE_RANGE) ? octets : undefined;
};

const ipv4Value = (octets: readonly number[]): number =>
  octets.reduce((value, octet) => value * BYTE_RANGE + octet, 0);

// A trailing dotted IPv4 ("::ffff:127.0.0.1") becomes two hex groups.
const withHexTail = (text: string): string | undefined => {
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (!tail.includes(".")) {
    return text;
  }
  const octets = parseIpv4(tail);
  if (!octets) {
    return undefined;
  }
  const [first = 0, second = 0, third = 0, fourth = 0] = octets;
  const high = first * BYTE_RANGE + second;
  const low = third * BYTE_RANGE + fourth;
  return `${text.slice(0, lastColon + 1)}${high.toString(HEX_RADIX)}:${low.toString(HEX_RADIX)}`;
};

// Expands any textual IPv6 form (including "::") to its eight 16-bit groups.
const parseIpv6Groups = (text: string): readonly number[] | undefined => {
  const normalized = withHexTail(text.split("%")[0] ?? text);
  if (normalized === undefined) {
    return undefined;
  }
  const [head = "", rest, extra] = normalized.split("::");
  const headGroups = head === "" ? [] : head.split(":");
  const restGroups = rest === undefined || rest === "" ? [] : rest.split(":");
  const missing = IPV6_GROUPS - headGroups.length - restGroups.length;
  const hasGap = rest !== undefined;
  if (extra !== undefined || (hasGap ? missing < 1 : missing !== 0)) {
    return undefined;
  }
  const groups = [
    ...headGroups,
    ...Array.from({ length: hasGap ? missing : 0 }, () => "0"),
    ...restGroups,
  ].map((group) => Number.parseInt(group, HEX_RADIX));
  return groups.every((group) => group >= 0 && group <= MAX_GROUP)
    ? groups
    : undefined;
};

interface Ipv4Range {
  readonly start: number;
  readonly size: number;
}

interface Ipv6Prefix {
  readonly groups: readonly number[];
  readonly bits: number;
}

const GROUP_BITS = 16;

const IPV4_BLOCKED = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  // Multicast, reserved and broadcast.
  "224.0.0.0/3",
].map((cidr): Ipv4Range => {
  const [base = "", bits = "0"] = cidr.split("/");
  const start = ipv4Value(parseIpv4(base) ?? []);
  return { size: 2 ** (IPV4_BITS - Number(bits)), start };
});

const IPV6_BLOCKED = [
  // Unspecified, loopback and IPv4-compatible addresses.
  "::/96",
  // NAT64 and the discard prefix.
  "64:ff9b::/96",
  "100::/64",
  // Teredo and documentation.
  "2001::/32",
  "2001:db8::/32",
  // Unique local, link-local, site-local and multicast.
  "fc00::/7",
  "fe80::/10",
  "fec0::/10",
  "ff00::/8",
].map((cidr): Ipv6Prefix => {
  const [base = "", bits = "0"] = cidr.split("/");
  return { bits: Number(bits), groups: parseIpv6Groups(base) ?? [] };
});

// Compares the leading `bits` bits of two addresses group by group.
const hasPrefix = (
  groups: readonly number[],
  { bits, groups: prefix }: Ipv6Prefix
): boolean =>
  prefix.every((expected, index) => {
    const covered = Math.min(
      GROUP_BITS,
      Math.max(0, bits - index * GROUP_BITS)
    );
    const unit = 2 ** (GROUP_BITS - covered);
    return (
      covered === 0 ||
      Math.floor((groups[index] ?? 0) / unit) === Math.floor(expected / unit)
    );
  });

const isBlockedIpv4 = (octets: readonly number[]): boolean => {
  const value = ipv4Value(octets);
  return IPV4_BLOCKED.some(
    ({ size, start }) => value >= start && value < start + size
  );
};

const IPV4_MAPPED_PREFIX = 0xff_ff;

// Addresses that merely wrap an IPv4 address are judged by what they wrap:
// IPv4-mapped (::ffff:a.b.c.d) and 6to4 (2002:aabb:ccdd::).
const sixToFour = 0x20_02;

const octetsOf = (high: number, low: number): number[] => [
  Math.floor(high / BYTE_RANGE),
  high % BYTE_RANGE,
  Math.floor(low / BYTE_RANGE),
  low % BYTE_RANGE,
];

const embeddedIpv4 = (groups: readonly number[]): number[] | undefined => {
  const [first = 0, second = 0, third = 0] = groups;
  const isMapped =
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === IPV4_MAPPED_PREFIX;
  if (isMapped) {
    const [high = 0, low = 0] = groups.slice(6);
    return octetsOf(high, low);
  }
  return first === sixToFour ? octetsOf(second, third) : undefined;
};

const isBlockedIpv6 = (groups: readonly number[]): boolean => {
  const wrapped = embeddedIpv4(groups);
  if (wrapped) {
    return isBlockedIpv4(wrapped);
  }
  return IPV6_BLOCKED.some((prefix) => hasPrefix(groups, prefix));
};

/** True for anything that is not a routable public unicast address. */
export const isBlockedAddress = (address: string): boolean => {
  const version = isIP(address);
  if (version === 4) {
    const octets = parseIpv4(address);
    return !octets || isBlockedIpv4(octets);
  }
  if (version === 6) {
    const groups = parseIpv6Groups(address);
    return !groups || isBlockedIpv6(groups);
  }
  return true;
};

const BLOCKED_NAME_SUFFIXES = [".localhost", ".local", ".internal"] as const;

const isBlockedName = (hostname: string): boolean =>
  hostname === "localhost" ||
  BLOCKED_NAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix));

export interface UrlPolicy {
  readonly production: boolean;
}

/** Static checks that need no DNS: scheme, credentials, literal hosts. */
export const parseWebhookUrl = (raw: string, policy: UrlPolicy): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return refuse("Enter a valid URL.");
  }
  const allowedSchemes = policy.production ? ["https:"] : ["https:", "http:"];
  if (!allowedSchemes.includes(url.protocol)) {
    return refuse(
      policy.production
        ? "Webhook URLs must use HTTPS."
        : "Webhook URLs must use HTTP or HTTPS."
    );
  }
  if (url.username || url.password) {
    return refuse("Webhook URLs cannot contain credentials.");
  }
  const hostname = url.hostname.replaceAll(/^\[|\]$/gu, "").toLowerCase();
  if (isBlockedName(hostname)) {
    return refuse("That host is not allowed.");
  }
  if (isIP(hostname) !== 0 && isBlockedAddress(hostname)) {
    return refuse("That address is not allowed.");
  }
  return url;
};

/**
 * Resolves the host and returns the address to connect to. Every resolved
 * address must be public: one private answer rejects the whole name.
 */
export const resolvePublicTarget = async (
  url: URL,
  resolve: HostResolver
): Promise<ResolvedAddress> => {
  const hostname = url.hostname.replaceAll(/^\[|\]$/gu, "");
  const literal = isIP(hostname);
  let addresses: readonly ResolvedAddress[];
  try {
    addresses =
      literal === 0
        ? await resolve(hostname)
        : [{ address: hostname, family: literal === 6 ? 6 : 4 }];
  } catch {
    throw new AppError({
      code: "UNAVAILABLE",
      message: "The webhook host could not be resolved.",
    });
  }
  const [first] = addresses;
  if (!first || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "The webhook host resolves to a blocked address.",
    });
  }
  return first;
};
