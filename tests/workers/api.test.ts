import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../apps/api/src/index";
import { reserveQuota, quotaKey } from "../../apps/api/src/quota";
const network = vi.fn<typeof fetch>();
beforeEach(async () => {
  network
    .mockReset()
    .mockRejectedValue(new Error("Unexpected external request"));
  vi.stubGlobal("fetch", network);
  await env.QUOTAS.exec(
    "CREATE TABLE IF NOT EXISTS quota_windows (key_hash TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL); DELETE FROM quota_windows;"
  );
  env.LIVE_SCAN_ENABLED = "true";
  env.TURNSTILE_SECRET = "unit-test-secret";
  env.QUOTA_HMAC_SECRET = "test-independent-hmac-secret-32-characters";
  env.TURNSTILE_SITE_KEY = "test-site-key";
  env.TURNSTILE_HOSTNAMES = "cyberlab.test";
  env.SELF_HOSTS = "cyberlab.test";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const request = (body: unknown, origin = "https://cyberlab.test") =>
  new Request("https://cyberlab.test/api/v1/web-scans", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "cf-connecting-ip": "203.0.113.8"
    },
    body: JSON.stringify(body)
  });
const valid = {
  url: "https://example.com/",
  turnstileToken: "test-single-use-token"
};
const challenge = (data: object) =>
  network.mockResolvedValueOnce(Response.json(data));
describe("Worker API", () => {
  it("keeps live scanning unavailable without backend secrets", async () => {
    env.TURNSTILE_SECRET = "";
    const response = await api.fetch(
      new Request("https://cyberlab.test/api/v1/config"),
      env
    );
    expect(
      ((await response.json()) as { liveScanEnabled: boolean }).liveScanEnabled
    ).toBe(false);
  });
  it("serves SPA routes with mutable security headers", async () => {
    const response = await api.fetch(
      new Request("https://cyberlab.test/ar"),
      env
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'self'"
    );
    expect(await response.text()).toContain('id="root"');
  });
  it("returns a safe health/config response and generated OpenAPI", async () => {
    const health = await api.fetch(
      new Request("https://cyberlab.test/healthz"),
      env
    );
    expect(health.status).toBe(200);
    expect(health.headers.get("content-security-policy")).toContain(
      "default-src 'self'"
    );
    const config = await api.fetch(
      new Request("https://cyberlab.test/api/v1/config"),
      env
    );
    const text = await config.text();
    expect(text).not.toContain("unit-test-secret");
    expect(text).not.toContain("hmac-secret");
    expect(config.headers.get("cache-control")).toBe("no-store");
    const docs = await api.fetch(
      new Request("https://cyberlab.test/api/v1/openapi.json"),
      env
    );
    expect(((await docs.json()) as { openapi: string }).openapi).toBe("3.1.0");
  });
  it("rejects foreign origins", async () =>
    expect(
      (await api.fetch(request(valid, "https://evil.example"), env)).status
    ).toBe(403));
  it("rejects oversized bodies before parsing", async () =>
    expect(
      (
        await api.fetch(
          request({ url: "x".repeat(9000), turnstileToken: "x" }),
          env
        )
      ).status
    ).toBe(413));
  it("validates body schema", async () =>
    expect(
      (await api.fetch(request({ url: "https://example.com" }), env)).status
    ).toBe(400));
  it("honors the emergency stop", async () => {
    env.LIVE_SCAN_ENABLED = "false";
    expect((await api.fetch(request(valid), env)).status).toBe(503);
  });
  it("blocks direct private targets before challenge verification", async () => {
    const result = await api.fetch(
      request({ ...valid, url: "http://127.0.0.1" }),
      env
    );
    expect(result.status).toBe(422);
  });
  it.each([
    { success: false },
    { success: true, hostname: "evil.example", action: "web-scan" },
    { success: true, hostname: "cyberlab.test", action: "other" }
  ])("rejects an invalid challenge result %j", async (data) => {
    challenge(data);
    expect((await api.fetch(request(valid), env)).status).toBe(403);
  });
  it("checks the challenge before invoking the internal scanner", async () => {
    challenge({ success: true, hostname: "cyberlab.test", action: "web-scan" });
    const result = await api.fetch(request(valid), env);
    expect(result.status).toBe(200);
    const json = (await result.json()) as { toolId: string; source: string };
    expect(json.toolId).toBe("web");
    expect(json.source).toBe("live");
  });
  it("fails closed if the quota secret is missing", async () => {
    env.QUOTA_HMAC_SECRET = "";
    expect((await api.fetch(request(valid), env)).status).toBe(503);
  });
  it("limits invalid challenge traffic before further verification calls", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1793350800000);
    network.mockImplementation(async () => Response.json({ success: false }));
    for (let i = 0; i < 20; i++)
      expect((await api.fetch(request(valid), env)).status).toBe(403);
    const response = await api.fetch(request(valid), env);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(network).toHaveBeenCalledTimes(20);
  });
  it("returns JSON 404 for unknown APIs", async () => {
    const result = await api.fetch(
      new Request("https://cyberlab.test/api/unknown"),
      env
    );
    expect(result.status).toBe(404);
    expect(await result.json()).toEqual({ error: { code: "NOT_FOUND" } });
  });
});
describe("real D1 quota behavior", () => {
  it("does not exceed a limit under concurrent reservations", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        reserveQuota(
          env.QUOTAS,
          env.QUOTA_HMAC_SECRET!,
          "203.0.113.9",
          "example.com",
          { minute: 3, day: 50, host: 100, global: 100 },
          1234567890000
        )
      )
    );
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(3);
    const rows = await env.QUOTAS.prepare("SELECT * FROM quota_windows").all();
    const text = JSON.stringify(rows.results);
    expect(text).not.toContain("203.0.113.9");
    expect(text).not.toContain("example.com");
    expect(
      rows.results.every(
        (x) => typeof x.key_hash === "string" && x.key_hash.length === 64
      )
    ).toBe(true);
  });
  it("changes pseudonyms across windows and scopes", async () => {
    const secret = env.QUOTA_HMAC_SECRET!;
    expect(await quotaKey(secret, "ip", "a", 1)).not.toBe(
      await quotaKey(secret, "ip", "a", 2)
    );
    expect(await quotaKey(secret, "ip", "a", 1)).not.toBe(
      await quotaKey(secret, "host", "a", 1)
    );
  });
  it("removes expired counters through the scheduled handler", async () => {
    await env.QUOTAS.prepare("INSERT INTO quota_windows VALUES (?,1,?)")
      .bind("expired", 0)
      .run();
    await api.scheduled({} as ScheduledController, env);
    expect(
      await env.QUOTAS.prepare("SELECT COUNT(*) AS n FROM quota_windows").first(
        "n"
      )
    ).toBe(0);
  });
});
