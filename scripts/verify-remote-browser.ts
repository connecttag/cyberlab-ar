import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { chromium, expect, type Browser } from "@playwright/test";
const credentials = join(
  process.platform === "win32"
    ? join(process.env.APPDATA!, "xdg.config")
    : (process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")),
  ".wrangler",
  "config",
  "default.toml"
);
const oauth = (await readFile(credentials, "utf8")).match(
  /^oauth_token\s*=\s*"([^"]+)"/m
)?.[1];
if (!oauth) throw new Error("Wrangler OAuth is required.");
const cli = (args: string[]) =>
  spawnSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      ...args,
      "-c",
      "apps/api/wrangler.jsonc",
      "--env="
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        WRANGLER_WRITE_LOGS: "false",
        CLOUDFLARE_SEND_METRICS: "false"
      }
    }
  );
const created = cli([
  "browser",
  "create",
  "--json",
  "--keepAlive",
  process.argv.includes("--interactive") ? "600" : "60",
  "--open=false"
]);
if (created.status !== 0)
  throw new Error("Could not create a bounded remote QA browser.");
const session = JSON.parse(created.stdout) as {
  sessionId: string;
  webSocketDebuggerUrl: string;
};
let browser: Browser | undefined;
await mkdir("output/verification", { recursive: true });
try {
  if (new URL(session.webSocketDebuggerUrl).hostname !== "api.cloudflare.com")
    throw new Error("Unexpected remote browser endpoint.");
  browser = await chromium.connectOverCDP(session.webSocketDebuggerUrl, {
    headers: { Authorization: "Bearer " + oauth },
    timeout: 15000
  });
  const page = await browser.newPage({
    viewport: { width: 1365, height: 900 }
  });
  const production = process.argv.includes("--production");
  const prefix = production ? "production-" : "";
  const host = production
    ? "https://cyberlab-ar.connecttag.workers.dev"
    : "https://cyberlab-ar-staging.connecttag.workers.dev";
  await page.goto(host + "/ar", {
    waitUntil: "domcontentloaded",
    timeout: 20000
  });
  await page
    .getByRole("heading", { name: "نظرة عامة", exact: true })
    .waitFor({ timeout: 10000 });
  await page.screenshot({
    path: `output/verification/${prefix}deployed-overview.png`,
    fullPage: true
  });
  const health = await page.evaluate(async () => {
    const response = await fetch("/healthz");
    return { status: response.status, json: await response.json() };
  });
  const config = await page.evaluate(async () => {
    const response = await fetch("/api/v1/config");
    const json = (await response.json()) as {
      liveScanEnabled: boolean;
      version: string;
    };
    return {
      status: response.status,
      liveScanEnabled: json.liveScanEnabled,
      version: json.version
    };
  });
  if (process.argv.includes("--observe-only")) {
    const rejected = await page.evaluate(async () => {
      const response = await fetch("/api/v1/web-scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/",
          turnstileToken: "intentionally-invalid-qa-token"
        })
      });
      const json = (await response.json()) as { error?: { code?: string } };
      return { status: response.status, code: json.error?.code };
    });
    const record = { host, health, config, interfaceVisible: true, rejected };
    await writeFile(
      `output/verification/${prefix}deployment.json`,
      JSON.stringify(record, null, 2)
    );
    console.log(JSON.stringify(record));
  } else {
    await page.goto(host + "/en/web", {
      waitUntil: "domcontentloaded",
      timeout: 20000
    });
    await page
      .getByRole("heading", { name: "Web security audit", exact: true })
      .waitFor({ timeout: 10000 });
    let automaticVerification = false;
    try {
      await expect(
        page.locator('input[name="cf-turnstile-response"]')
      ).not.toHaveValue("", { timeout: 10000 });
      automaticVerification = true;
    } catch {
      /* Never click or solve a challenge automatically. */
    }
    let verified = automaticVerification;
    let manuallyApproved = false;
    if (!verified && process.argv.includes("--interactive")) {
      await page
        .getByLabel("Website URL", { exact: true })
        .fill("https://example.com/");
      await page.screenshot({
        path: "output/verification/captcha-handoff.png",
        fullPage: true
      });
      console.log(
        "CAPTCHA_READY: awaiting an explicitly approved operator action; no challenge is clicked automatically."
      );
      const reader = createInterface({
        input: process.stdin,
        crlfDelay: Infinity
      });
      const iterator = reader[Symbol.asyncIterator]();
      const deadline = Date.now() + 180000;
      try {
        while (Date.now() < deadline) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const line = await Promise.race([
            iterator.next(),
            new Promise<null>((resolve) => {
              timer = setTimeout(
                () => resolve(null),
                Math.max(1, deadline - Date.now())
              );
            })
          ]);
          if (timer) clearTimeout(timer);
          if (!line || line.done) break;
          const command = JSON.parse(line.value) as {
            action: string;
            x?: number;
            y?: number;
          };
          if (command.action === "capture") {
            await page.screenshot({
              path: "output/verification/captcha-handoff.png",
              fullPage: true
            });
            console.log("CAPTCHA_CAPTURED");
            continue;
          }
          if (
            command.action === "click" &&
            Number.isFinite(command.x) &&
            Number.isFinite(command.y) &&
            command.x! >= 0 &&
            command.x! <= 1365 &&
            command.y! >= 0 &&
            command.y! <= 900
          ) {
            await page.mouse.click(command.x!, command.y!);
            manuallyApproved = true;
            try {
              await expect(
                page.locator('input[name="cf-turnstile-response"]')
              ).not.toHaveValue("", { timeout: 20000 });
              verified = true;
            } catch {
              /* A further challenge requires a human; never retry or solve automatically. */
            }
          }
          break;
        }
      } finally {
        reader.close();
      }
    }
    let liveResult =
      "not attempted: managed challenge did not complete automatically";
    if (verified) {
      await page
        .getByLabel("Website URL", { exact: true })
        .fill("https://example.com/");
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v1/web-scans") &&
          response.request().method() === "POST",
        { timeout: 25000 }
      );
      await page.getByRole("button", { name: "Analyze", exact: true }).click();
      const response = await responsePromise;
      const result = await response.json();
      liveResult = response.ok()
        ? "HTTP " + response.status() + " / " + result.status
        : "HTTP " + response.status() + " / " + result.error?.code;
    }
    await page.screenshot({
      path: "output/verification/deployed-web.png",
      fullPage: true
    });
    const record = {
      host,
      health,
      config,
      interfaceVisible: true,
      automaticVerification,
      manuallyApproved,
      liveResult
    };
    await writeFile(
      `output/verification/${prefix}${manuallyApproved ? "interactive-" : ""}remote-browser.json`,
      JSON.stringify(record, null, 2)
    );
    console.log(JSON.stringify(record));
  }
} finally {
  await browser?.close().catch(() => {});
  cli(["browser", "close", session.sessionId, "--json"]);
}
