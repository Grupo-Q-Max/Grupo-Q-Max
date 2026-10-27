import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Loopback, private, link-local (Azure metadata 169.254.169.254), CGNAT and unspecified ranges.
// BlockList also matches IPv4-mapped IPv6 (::ffff:127.0.0.1) against the IPv4 subnets.
const internal = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
] as const) internal.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 127],
  ["fc00::", 7],
  ["fe80::", 10],
] as const) internal.addSubnet(network, prefix, "ipv6");

export const isInternalAddress = (address: string) => {
  const family = isIP(address);
  return family === 0 || internal.check(address, family === 4 ? "ipv4" : "ipv6");
};

/**
 * True when every address the URL's host resolves to is public, so a webhook can't reach the
 * server's own network. Unresolvable hosts count as not public.
 * ponytail: fetch resolves the host again (DNS rebinding window); pin the address with an undici
 * dispatcher if that ever matters.
 */
export async function isPublicUrl(url: string) {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isInternalAddress(address));
  } catch {
    return false;
  }
}
