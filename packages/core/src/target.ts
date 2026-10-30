import ipaddr from "ipaddr.js";
export class ScanError extends Error {
  constructor(
    public code: string,
    public httpStatus = 422
  ) {
    super(code);
    this.name = "ScanError";
  }
}
const forbiddenNames =
  /(^|\.)(localhost|local|internal|invalid|test|example|onion|home|lan)$/i;
export function isPublicIp(value: string): boolean {
  try {
    const ip = ipaddr.parse(value);
    if (ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress())
      return isPublicIp((ip as ipaddr.IPv6).toIPv4Address().toString());
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export function validateTarget(raw: string, selfHosts: string[] = []): URL {
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : "https://" + raw);
  } catch {
    throw new ScanError("INVALID_URL");
  }
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && u.port !== (u.protocol === "http:" ? "80" : "443"))
  )
    throw new ScanError("BLOCKED_TARGET");
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host.includes(".") ||
    host.includes("%") ||
    host.startsWith("[") ||
    ipaddr.isValid(host) ||
    forbiddenNames.test(host) ||
    host === "metadata.google.internal" ||
    selfHosts.some((x) => host === x.toLowerCase().replace(/\.$/, ""))
  )
    throw new ScanError("BLOCKED_TARGET");
  u.hostname = host;
  u.hash = "";
  return u;
}
export interface DnsRecord {
  name: string;
  type: number;
  data: string;
  TTL: number;
}
export interface DnsSnapshot {
  records: DnsRecord[];
  addresses: string[];
}
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export async function resolveTarget(
  host: string,
  fetcher: Fetcher = fetch,
  signal?: AbortSignal
): Promise<DnsSnapshot> {
  const replies = await Promise.all(
    ["A", "AAAA", "CAA"].map(async (type) => {
      const response = await fetcher(
        "https://cloudflare-dns.com/dns-query?name=" +
          encodeURIComponent(host) +
          "&type=" +
          type,
        {
          headers: { accept: "application/dns-json" },
          signal,
          redirect: "manual"
        }
      );
      if (!response.ok) throw new ScanError("DNS_UNAVAILABLE", 503);
      const text = await boundedText(response, 48 * 1024);
      let json: { Status: number; Answer?: DnsRecord[] };
      try {
        json = JSON.parse(text);
      } catch {
        throw new ScanError("DNS_UNAVAILABLE", 503);
      }
      if (json.Status !== 0) throw new ScanError("DNS_FAILED");
      return (json.Answer ?? []).filter(
        (x) =>
          [1, 5, 28, 257].includes(x.type) &&
          typeof x.data === "string" &&
          x.data.length < 2048
      );
    })
  );
  const records = replies.flat();
  const addresses = records
    .filter((x) => [1, 28].includes(x.type))
    .map((x) => x.data);
  if (addresses.length === 0) throw new ScanError("DNS_FAILED");
  if (addresses.some((x) => !isPublicIp(x)))
    throw new ScanError("BLOCKED_TARGET");
  return {
    records: [
      ...new Map(
        records.map((x) => [x.name + "|" + x.type + "|" + x.data, x])
      ).values()
    ],
    addresses
  };
}
export async function boundedText(
  response: Response,
  limit: number
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) throw new ScanError("RESPONSE_TOO_LARGE");
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const all = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(all);
}
