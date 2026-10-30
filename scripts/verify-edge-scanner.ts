import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getPlatformProxy } from "wrangler";
import { parse } from "jsonc-parser";
import { reportSchema } from "../packages/core/src/report";
import { maskIp, redactText } from "../packages/core/src/redact";
const config = parse(await readFile("apps/api/wrangler.jsonc", "utf8"));
const path = ".wrangler/scanner-verification.json";
await mkdir(".wrangler", { recursive: true });
await mkdir("output/verification", { recursive: true });
await writeFile(
  path,
  JSON.stringify({
    name: "cyberlab-private-verification",
    account_id: config.account_id,
    compatibility_date: "2026-10-23",
    compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
    services: [
      {
        binding: "SCANNER",
        service: "cyberlab-ar-scanner-staging",
        remote: true
      }
    ]
  })
);
const proxy = await getPlatformProxy<{ SCANNER: Fetcher }>({
  configPath: resolve(path),
  persist: false
});
try {
  const probe = await proxy.env.SCANNER.fetch(
    "https://scanner.internal/healthz"
  );
  if (probe.status !== 404)
    throw new Error(
      "Private binding transport is unavailable: probe HTTP " + probe.status
    );
  const response = await proxy.env.SCANNER.fetch(
    "https://scanner.internal/scan",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/",
        selfHosts: config.env.staging.vars.SELF_HOSTS.split(",")
      })
    }
  );
  if (!response.ok) {
    const detail = maskIp(redactText(await response.text()))
      .replace(/[A-Za-z0-9_./+-]{48,}/g, "[omitted]")
      .slice(0, 1400);
    throw new Error(
      "Edge scanner returned HTTP " + response.status + ": " + detail
    );
  }
  const report = reportSchema.parse(await response.json());
  await writeFile(
    "output/verification/edge-scanner.json",
    JSON.stringify(report, null, 2)
  );
  const denied = await proxy.env.SCANNER.fetch(
    "https://scanner.internal/scan",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1/", selfHosts: [] })
    }
  );
  if (denied.status !== 422) throw new Error("Private-target boundary failed");
  console.log(
    JSON.stringify({
      runtime: "Cloudflare private service binding",
      status: report.status,
      observedHttpStatus: report.observations.find((x) => x.key === "status")
        ?.value,
      findings: report.findings.length,
      privateTargetRejected: true
    })
  );
} finally {
  await proxy.dispose();
}
