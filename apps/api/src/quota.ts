export interface QuotaConfig {
  minute: number;
  day: number;
  host: number;
  global: number;
}
export class QuotaExceeded extends Error {
  constructor(public retryAfter: number) {
    super("QUOTA_EXCEEDED");
  }
}
export async function quotaKey(
  secret: string,
  scope: string,
  subject: string,
  window: number
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(scope + "|" + window + "|" + subject)
  );
  return Array.from(new Uint8Array(signed), (x) =>
    x.toString(16).padStart(2, "0")
  ).join("");
}
export async function reserveQuota(
  db: D1Database,
  secret: string,
  ip: string,
  host: string,
  config: QuotaConfig,
  now = Date.now()
): Promise<void> {
  if (secret.length < 32) throw new Error("QUOTAS_UNAVAILABLE");
  // Each conditional UPSERT reserves one slot atomically. Rejected attempts may
  // consume earlier limits, but can never overrun a later limit under concurrency.
  const limits: [string, string, number, number][] = [
    ["ip-minute", ip, 60000, config.minute],
    ["ip-day", ip, 86400000, config.day],
    ["host-minute", host, 60000, config.host],
    ["global-day", "global", 86400000, config.global]
  ];
  for (const [scope, subject, span, limit] of limits) {
    const window = Math.floor(now / span),
      expires = (window + 1) * span;
    const key = await quotaKey(secret, scope, subject, window);
    const row = await db
      .prepare(
        "INSERT INTO quota_windows (key_hash,count,expires_at) VALUES (?,1,?) ON CONFLICT(key_hash) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count"
      )
      .bind(key, expires, limit)
      .first<{ count: number }>();
    if (!row)
      throw new QuotaExceeded(Math.max(1, Math.ceil((expires - now) / 1000)));
  }
}
export async function reserveChallenge(
  db: D1Database,
  secret: string,
  ip: string,
  now = Date.now()
): Promise<void> {
  if (secret.length < 32) throw new Error("QUOTAS_UNAVAILABLE");
  const window = Math.floor(now / 60000),
    expires = (window + 1) * 60000,
    key = await quotaKey(secret, "challenge-minute", ip, window);
  const row = await db
    .prepare(
      "INSERT INTO quota_windows (key_hash,count,expires_at) VALUES (?,1,?) ON CONFLICT(key_hash) DO UPDATE SET count=count+1 WHERE count < 20 RETURNING count"
    )
    .bind(key, expires)
    .first();
  if (!row)
    throw new QuotaExceeded(Math.max(1, Math.ceil((expires - now) / 1000)));
}
