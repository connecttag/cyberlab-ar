// Optional QA only: creates an authenticated fixed-target probe, runs it once,
// and removes it in finally. No production endpoint or Turnstile bypass exists.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chromium, type Browser } from "@playwright/test";
import { parse } from "jsonc-parser";
import { reportSchema } from "../packages/core/src/report";
import { z } from "zod";
const app = parse(await readFile("apps/api/wrangler.jsonc", "utf8"));
await mkdir(".wrangler/edge-qa", { recursive: true });
await mkdir("output/verification", { recursive: true });
const configPath = resolve(".wrangler/edge-qa/wrangler.json");
const workerName = "cyberlab-ar-scanner-qa";
await writeFile(
  configPath,
  JSON.stringify({
    name: workerName,
    account_id: app.account_id,
    main: resolve("scripts/fixtures/edge-probe.ts"),
    compatibility_date: "2026-10-23",
    compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
    workers_dev: true,
    preview_urls: false,
    services: [{ binding: "SCANNER", service: "cyberlab-ar-scanner-staging" }],
    observability: { enabled: false }
  })
);
function cli(args: string[], input?: string) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/wrangler/bin/wrangler.js", ...args, "-c", configPath],
    {
      encoding: "utf8",
      input,
      env: {
        ...process.env,
        WRANGLER_WRITE_LOGS: "false",
        CLOUDFLARE_SEND_METRICS: "false"
      }
    }
  );
  if (result.status !== 0)
    throw new Error("Optional deployment QA command failed: " + args[0]);
  return result.stdout;
}
let deployed = false,
  browser: Browser | undefined,
  sessionId: string | undefined;
try {
  // Confirm this reserved, task-owned temporary name is unused before creating.
  const authPath =
    process.platform === "win32"
      ? join(
          process.env.APPDATA!,
          "xdg.config",
          ".wrangler/config/default.toml"
        )
      : join(
          process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
          ".wrangler/config/default.toml"
        );
  const token = (await readFile(authPath, "utf8")).match(
    /^oauth_token\s*=\s*"([^"]+)"/m
  )?.[1];
  if (!token) throw new Error("Wrangler OAuth is required.");
  const existing = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${app.account_id}/workers/services/${workerName}`,
    { headers: { authorization: "Bearer " + token } }
  );
  if (existing.status !== 404)
    throw new Error(
      "Temporary QA worker name is already present or cannot be checked; refusing to replace it."
    );
  cli(["deploy"]);
  deployed = true;
  const gate = randomBytes(48).toString("base64url");
  cli(["secret", "put", "QA_GATE"], gate);
  const session = JSON.parse(
    cli(["browser", "create", "--json", "--keepAlive", "60", "--open=false"])
  );
  sessionId = session.sessionId;
  if (new URL(session.webSocketDebuggerUrl).hostname !== "api.cloudflare.com")
    throw new Error("Unexpected browser endpoint.");
  browser = await chromium.connectOverCDP(session.webSocketDebuggerUrl, {
    headers: { authorization: "Bearer " + token },
    timeout: 15000
  });
  const page = await browser.newPage();
  const host = "https://" + workerName + ".connecttag.workers.dev";
  await page.setExtraHTTPHeaders({ authorization: "Bearer " + gate });
  const response = await page.goto(host, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  if (!response) throw new Error("Missing deployment QA response.");
  const result = { status: response.status(), json: await response.json() };
  await writeFile(
    "output/verification/deployed-scanner.json",
    JSON.stringify(result, null, 2)
  );
  const resultSchema = z.object({
    transportProbe: z.number(),
    blocked: z.object({
      status: z.number(),
      result: z.object({ error: z.object({ code: z.string() }) })
    }),
    scan: z.object({ status: z.number(), result: z.unknown() })
  });
  const json = resultSchema.parse(result.json);
  const report = reportSchema.parse(json.scan.result);
  if (
    json.transportProbe !== 404 ||
    json.blocked.status !== 422 ||
    json.blocked.result.error.code !== "BLOCKED_TARGET"
  )
    throw new Error("Deployed boundary verification failed.");
  if (json.scan.status !== 200) throw new Error("Deployed scan failed.");
  console.log(
    JSON.stringify({
      runtime: "deployed Cloudflare scanner",
      status: report.status,
      observations: report.observations.length,
      findings: report.findings.length,
      blockedTarget: true
    })
  );
} finally {
  await browser?.close().catch(() => {});
  try {
    if (sessionId) cli(["browser", "close", sessionId, "--json"]);
  } finally {
    if (deployed) {
      cli(["delete", "--force"]);
      console.log("Temporary QA worker removed.");
    }
  }
}
