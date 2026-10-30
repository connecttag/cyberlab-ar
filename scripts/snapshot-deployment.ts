import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse } from "jsonc-parser";
// Optional deployment QA using Cloudflare's browser, useful when a developer's
// DNS cannot resolve workers.dev. It is never part of visitor processing.
const config = parse(await readFile("apps/api/wrangler.jsonc", "utf8"));
const authPath =
  process.platform === "win32"
    ? join(
        process.env.APPDATA!,
        "xdg.config",
        ".wrangler",
        "config",
        "default.toml"
      )
    : join(
        process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
        ".wrangler",
        "config",
        "default.toml"
      );
const auth = await readFile(authPath, "utf8");
const token = auth.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token)
  throw new Error(
    "Wrangler OAuth credentials are required. No credentials are printed."
  );
await mkdir("output/verification", { recursive: true });
const host = "https://cyberlab-ar-staging.connecttag.workers.dev";
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/browser-rendering/`;
const headers = {
  "content-type": "application/json",
  authorization: "Bearer " + token
};
const response = await fetch(endpoint + "content", {
  method: "POST",
  headers,
  body: JSON.stringify({
    url: host + "/healthz",
    gotoOptions: { waitUntil: "domcontentloaded", timeout: 15000 }
  }),
  signal: AbortSignal.timeout(20000)
});
const json = (await response.json()) as {
  success: boolean;
  result?: string;
  errors?: { code: number; message: string }[];
};
if (!response.ok || !json.success)
  throw new Error(
    "Remote browser API failed: " +
      JSON.stringify(
        json.errors?.map((x) => ({ code: x.code, message: x.message })) ?? []
      )
  );
await writeFile("output/verification/deployed-health.html", json.result ?? "");
console.log(
  JSON.stringify({
    remoteBrowser: true,
    healthObserved: !!json.result?.includes('"status":"ok"'),
    responseLength: json.result?.length
  })
);
const screenshot = await fetch(endpoint + "screenshot", {
  method: "POST",
  headers,
  body: JSON.stringify({
    url: host + "/ar",
    gotoOptions: { waitUntil: "networkidle0", timeout: 15000 },
    screenshotOptions: { fullPage: true }
  }),
  signal: AbortSignal.timeout(20000)
});
if (!screenshot.ok)
  throw new Error("Remote screenshot unavailable: HTTP " + screenshot.status);
await writeFile(
  "output/verification/deployed-overview.png",
  new Uint8Array(await screenshot.arrayBuffer())
);
console.log("Saved deployment screenshot.");
