import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyzeHeaders } from "../../packages/core/src/headers";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { liveScanEnabled: false, turnstileSiteKey: "" } })
  );
});
test("overview is responsive, bilingual, and supports a persisted theme", async ({
  page
}) => {
  await page.goto("/ar");
  await expect(
    page.getByRole("heading", { name: "نظرة عامة", exact: true })
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".tool-card")).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: "output/playwright/overview-" + test.info().project.name + ".png",
    fullPage: true
  });
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true })
  ).toBeVisible();
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("header sample runs locally with contextual findings and hidden cookies", async ({
  page
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/en/web");
  await page
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Analysis results" })
  ).toBeVisible();
  await page
    .getByText("Cookie attributes: demo_session", { exact: true })
    .click();
  await expect(
    page.locator(".finding-body").filter({ hasText: "demo_session=[REDACTED]" })
  ).toBeVisible();
  await expect(
    page.locator(".report").getByText("demo-value", { exact: false })
  ).toHaveCount(0);
  expect(posts).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page
    .getByRole("button", { name: "Save on this device", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved locally" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Open in report studio" }).click();
  await expect(page.locator(".report-row")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".report-row")).toHaveCount(1);
});
test("links and QR never navigate to or upload the analyzed target", async ({
  page
}) => {
  const outbound: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "example.org")
      outbound.push(request.url());
  });
  await page.goto("/en/url");
  await page
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Comparison", exact: true })
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles(resolve("tests/fixtures/link.png"));
  await expect(page.getByLabel("QR content as text")).toHaveValue(
    "https://example.org/?token=demo-qr"
  );
  await page.getByRole("button", { name: "Use content as URL" }).click();
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.locator(".report")).toContainText("example.org");
  expect(outbound).toEqual([]);
  await page
    .locator("input[type=file]")
    .setInputFiles(resolve("tests/fixtures/text.png"));
  await expect(page.getByLabel("QR content as text")).toHaveValue(
    "CyberLab local QR sample"
  );
});
test("browser properties require no sensitive permission requests", async ({
  page
}) => {
  await page.goto("/ar/browser");
  const requested = await page.evaluate(() => ({
    camera: !!navigator.mediaDevices,
    secure: isSecureContext
  }));
  expect(requested.secure).toBe(true);
  await page
    .getByRole("button", { name: "عرض معلومات متصفحي", exact: true })
    .click();
  await expect(page.locator(".report")).toContainText("السياق الآمن");
  await expect(page.locator(".report")).toContainText("لم يُطلب GPS");
});
test("log sample uses a worker, filters and exports CSV locally", async ({
  page
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/en/logs");
  await page
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Requests over time" })
  ).toBeVisible();
  await page.getByLabel("Status", { exact: true }).fill("5");
  await expect(page.getByText("22 events", { exact: true })).toBeVisible();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export filtered events CSV" })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("cyberlab-events.csv");
  const path = await download.path();
  const content = await readFile(path!, "utf8");
  expect(content).toContain("503");
  expect(content).not.toContain("403");
  expect(posts).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});
test("report studio prepares bilingual safe exports and rejects invalid imports", async ({
  page
}) => {
  await page.goto("/en/web");
  await page
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  await page.getByRole("button", { name: "Open in report studio" }).click();
  await page.locator(".report-row input[type=checkbox]").check();
  await page
    .getByLabel("Report title", { exact: true })
    .fill("Security review <script>alert(1)</script>");
  await page.getByRole("button", { name: /Prepare report/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Review the redacted version before downloading"
    })
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "HTML", exact: true }).click();
  const file = await pending;
  const html = await readFile((await file.path())!, "utf8");
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "استوديو التقارير", exact: true })
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schemaVersion":99}')
    });
  await expect(page.getByRole("alert")).toBeVisible();
});
test("bad log lines are counted and offset-free JSONL uses the selected time zone", async ({
  page
}) => {
  await page.goto("/en/logs");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "mapped.jsonl",
      mimeType: "text/plain",
      buffer: Buffer.from(
        '{"timestamp":"2026-10-30T12:00:00","ip":"203.0.113.9","path":"/login?token=secret","status":401}\nnot-json\n'
      )
    });
  await page
    .getByLabel("Time zone for offset-free timestamps")
    .selectOption("Asia/Riyadh");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(
    page.getByText("2026-10-30 09:00:00", { exact: true })
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Invalid lines: 1");
  await expect(page.locator(".report")).not.toContainText("token=secret");
});
test("local tools remain usable when IndexedDB is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      get() {
        throw new DOMException("Denied", "SecurityError");
      }
    });
  });
  await page.goto("/en/web");
  await page
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save on this device", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Local storage is unavailable" })
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download JSON", exact: true })
    .click();
  expect((await pending).suggestedFilename()).toBe("cyberlab-web.json");
});
test("PWA serves local tools offline and never caches APIs", async ({
  page,
  context
}) => {
  await page.goto("http://127.0.0.1:4173/en/url");
  await expect(
    page.getByRole("heading", { name: "Links & QR", exact: true })
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true }
        )
      );
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Comparison", exact: true })
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Log analysis", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Requests over time", exact: true })
  ).toBeVisible();
  const urls = await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map((request) => request.url)
        )
      )
    ).flat();
    return requests;
  });
  expect(urls.some((url) => new URL(url).pathname.startsWith("/api/"))).toBe(
    false
  );
  await context.setOffline(false);
});
test("log parsing can be cancelled without blocking the interface", async ({
  page
}) => {
  await page.goto("/en/logs");
  const line =
    '{"timestamp":"2026-10-30T12:00:00Z","ip":"203.0.113.4","path":"/api","status":200}\n';
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "large.jsonl",
      mimeType: "text/plain",
      buffer: Buffer.from(line.repeat(200000))
    });
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Processing cancelled.");
  await expect(
    page.getByRole("button", { name: "Analyze", exact: true })
  ).toBeEnabled();
});
test("live audit integrates token callbacks, request submission, and token reset", async ({
  page
}) => {
  await page.unroute("**/api/v1/config");
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({
      json: { liveScanEnabled: true, turnstileSiteKey: "local-test-fixture" }
    })
  );
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: "window.turnstile={render:(el,options)=>{el.textContent='Local verification fixture';queueMicrotask(()=>options.callback('local-fixture-token'));return 'fixture';},reset:()=>{window.fixtureReset=true},remove:()=>{}};"
      })
  );
  let submitted: unknown;
  await page.route("**/api/v1/web-scans", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({
      json: analyzeHeaders({
        url: "https://example.com/",
        headers: [["content-type", "text/html"]],
        source: "live"
      })
    });
  });
  await page.goto("/en/web");
  await expect(page.getByText("Local verification fixture")).toBeVisible();
  await page
    .getByLabel("Website URL", { exact: true })
    .fill("https://example.com/");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Analysis results" })
  ).toBeVisible();
  expect(submitted).toEqual({
    url: "https://example.com/",
    turnstileToken: "local-fixture-token"
  });
  expect(
    await page.evaluate(
      () => (window as Window & { fixtureReset?: boolean }).fixtureReset
    )
  ).toBe(true);
});
