import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import {
  ENGINE_VERSION,
  reportSchema,
  scanInputSchema
} from "@cyberlab/core/report";
import { boundedText, ScanError, validateTarget } from "@cyberlab/core/target";
import { reserveQuota, reserveChallenge, QuotaExceeded } from "./quota";
export const app = new OpenAPIHono<{ Bindings: AppEnv }>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json({ error: { code: "INVALID_REQUEST" } }, 400);
  }
});
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://challenges.cloudflare.com"],
      frameSrc: ["'self'", "blob:", "https://challenges.cloudflare.com"],
      workerSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    },
    referrerPolicy: "no-referrer",
    permissionsPolicy: { camera: [], microphone: [], geolocation: [] }
  })
);
app.use("/api/*", async (c, next) => {
  c.header("cache-control", "no-store");
  c.header("x-content-type-options", "nosniff");
  await next();
});
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 8192,
    onError: (c) => c.json({ error: { code: "REQUEST_TOO_LARGE" } }, 413)
  })
);
export function limits(env: AppEnv) {
  const n = (value: string, fallback: number, max: number) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= max
      ? parsed
      : fallback;
  };
  return {
    minute: n(env.PER_IP_MINUTE, 5, 100),
    day: n(env.PER_IP_DAY, 50, 1000),
    host: n(env.PER_HOST_MINUTE, 10, 100),
    global: n(env.MAX_SCANS_PER_DAY, 1000, 10000)
  };
}
app.get("/api/v1/config", (c) =>
  c.json({
    version: ENGINE_VERSION,
    liveScanEnabled:
      c.env.LIVE_SCAN_ENABLED === "true" &&
      !!c.env.TURNSTILE_SITE_KEY &&
      !!c.env.TURNSTILE_SECRET &&
      (c.env.QUOTA_HMAC_SECRET?.length ?? 0) >= 32 &&
      c.env.TURNSTILE_HOSTNAMES.split(",")
        .map((host) => host.trim())
        .includes(new URL(c.req.url).hostname),
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY,
    limits: limits(c.env),
    logMaxBytes: 50 * 1024 * 1024,
    logMaxEvents: 200000,
    reportSchemaVersion: 1
  })
);
app.get("/healthz", (c) =>
  c.json({ status: "ok", version: c.env.BUILD_VERSION })
);
const errorSchema = z.object({ error: z.object({ code: z.string() }) });
app.openapi(
  createRoute({
    method: "post",
    path: "/api/v1/web-scans",
    description:
      "Read-only HTTP settings audit. Results are returned synchronously and are not stored.",
    request: {
      body: { content: { "application/json": { schema: scanInputSchema } } }
    },
    responses: {
      200: {
        description: "Observed response report",
        content: { "application/json": { schema: reportSchema } }
      },
      400: {
        description: "Invalid request",
        content: { "application/json": { schema: errorSchema } }
      },
      403: {
        description: "Origin or challenge rejected",
        content: { "application/json": { schema: errorSchema } }
      },
      422: {
        description: "Invalid or unreachable target",
        content: { "application/json": { schema: errorSchema } }
      },
      429: {
        description: "Quota exceeded",
        content: { "application/json": { schema: errorSchema } }
      },
      503: {
        description: "Unavailable",
        content: { "application/json": { schema: errorSchema } }
      },
      504: {
        description: "Timeout",
        content: { "application/json": { schema: errorSchema } }
      }
    }
  }),
  async (c) => {
    const started = Date.now();
    const origin = c.req.header("origin");
    const ownOrigin = new URL(c.req.url).origin;
    if (!origin || origin !== ownOrigin)
      return c.json({ error: { code: "ORIGIN_REJECTED" } }, 403);
    if (
      c.env.LIVE_SCAN_ENABLED !== "true" ||
      !c.env.TURNSTILE_SECRET ||
      !c.env.TURNSTILE_SITE_KEY
    )
      return c.json({ error: { code: "LIVE_SCAN_UNAVAILABLE" } }, 503);
    try {
      const input = c.req.valid("json");
      const selfHosts = [
        new URL(c.req.url).hostname,
        ...c.env.SELF_HOSTS.split(",").filter(Boolean)
      ];
      const target = validateTarget(input.url, selfHosts);
      const ip = c.req.header("cf-connecting-ip");
      if (!ip) throw new Error("QUOTAS_UNAVAILABLE");
      await reserveChallenge(c.env.QUOTAS, c.env.QUOTA_HMAC_SECRET ?? "", ip);
      const expected = c.env.TURNSTILE_HOSTNAMES.split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      if (!expected.length) throw new Error("CONFIG_UNAVAILABLE");
      const response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            secret: c.env.TURNSTILE_SECRET,
            response: input.turnstileToken
          }),
          signal: AbortSignal.timeout(5000)
        }
      );
      if (!response.ok) throw new Error("CHALLENGE_UNAVAILABLE");
      const verified = z
        .object({
          success: z.boolean(),
          hostname: z.string().optional(),
          action: z.string().optional()
        })
        .safeParse(JSON.parse(await boundedText(response, 8192)));
      if (
        !verified.success ||
        !verified.data.success ||
        !expected.includes(verified.data.hostname ?? "") ||
        verified.data.action !== "web-scan"
      )
        return c.json({ error: { code: "CHALLENGE_REJECTED" } }, 403);
      await reserveQuota(
        c.env.QUOTAS,
        c.env.QUOTA_HMAC_SECRET ?? "",
        ip,
        target.hostname,
        limits(c.env)
      );
      const result = await c.env.SCANNER.fetch(
        "https://scanner.internal/scan",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: target.href, selfHosts }),
          signal: AbortSignal.timeout(
            Math.max(1, 20000 - (Date.now() - started))
          )
        }
      );
      const text = await boundedText(result, 1024 * 1024);
      const json: unknown = JSON.parse(text);
      if (!result.ok) {
        const parsed = errorSchema.safeParse(json);
        const known = [
          "BLOCKED_TARGET",
          "DNS_FAILED",
          "DNS_UNAVAILABLE",
          "REDIRECT_LOOP",
          "TOO_MANY_REDIRECTS",
          "INVALID_REDIRECT",
          "RESPONSE_TOO_LARGE",
          "TIMEOUT",
          "TARGET_UNREACHABLE"
        ];
        const code =
          parsed.success && known.includes(parsed.data.error.code)
            ? parsed.data.error.code
            : "SCAN_UNAVAILABLE";
        return c.json({ error: { code } }, code === "TIMEOUT" ? 504 : 422);
      }
      const parsed = reportSchema.safeParse(json);
      if (!parsed.success) throw new Error("INVALID_SCANNER_RESPONSE");
      console.log(
        JSON.stringify({
          event: "scan.completed",
          durationMs: Date.now() - started,
          status: parsed.data.status
        })
      );
      return c.json(parsed.data, 200);
    } catch (error) {
      if (error instanceof QuotaExceeded) {
        c.header("retry-after", String(error.retryAfter));
        return c.json({ error: { code: "QUOTA_EXCEEDED" } }, 429);
      }
      if (error instanceof ScanError)
        return c.json({ error: { code: error.code } }, 422);
      console.error(
        JSON.stringify({
          event: "scan.unavailable",
          durationMs: Date.now() - started
        })
      );
      return c.json({ error: { code: "SCAN_UNAVAILABLE" } }, 503);
    }
  }
);
app.doc("/api/v1/openapi.json", {
  openapi: "3.1.0",
  info: { title: "CyberLab API", version: ENGINE_VERSION }
});
app.all("/api/*", (c) => c.json({ error: { code: "NOT_FOUND" } }, 404));
app.all("*", async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  // Asset service responses have immutable headers on the edge. Clone before
  // Hono's response-security middleware appends the application policies.
  return new Response(asset.body, {
    status: asset.status,
    statusText: asset.statusText,
    headers: new Headers(asset.headers)
  });
});
app.onError((_error, c) => {
  console.error(JSON.stringify({ event: "request.failed" }));
  return c.json({ error: { code: "INTERNAL_ERROR" } }, 500);
});
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: AppEnv) {
    await env.QUOTAS.prepare("DELETE FROM quota_windows WHERE expires_at <= ?")
      .bind(Date.now())
      .run();
  }
} satisfies ExportedHandler<AppEnv>;
