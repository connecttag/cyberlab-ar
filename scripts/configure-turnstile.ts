import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";

const [environment, hostname] = process.argv.slice(2);
if (
  !["staging", "production"].includes(environment) ||
  !hostname ||
  !/^[a-z0-9][a-z0-9.-]+$/i.test(hostname)
)
  throw new Error(
    "Usage: configure-turnstile.ts staging|production exact-app-hostname"
  );
const configFile = "apps/api/wrangler.jsonc";
const globals = [
  "-c",
  configFile,
  ...(environment === "staging" ? ["--env", "staging"] : [])
];
function cli(args: string[], input?: string): string {
  // Native widget get/create include the secret in JSON. Capture only in memory
  // and explicitly disable Wrangler's disk logger before invoking those commands.
  const result = spawnSync(
    process.execPath,
    ["node_modules/wrangler/bin/wrangler.js", ...args, ...globals],
    {
      encoding: "utf8",
      input,
      env: {
        ...process.env,
        WRANGLER_WRITE_LOGS: "false",
        CLOUDFLARE_SEND_METRICS: "false"
      },
      maxBuffer: 4 * 1024 * 1024
    }
  );
  if (result.status !== 0)
    throw new Error(
      "Cloudflare operation failed (output withheld to protect credentials). Check authentication and project resources."
    );
  return result.stdout;
}
type Widget = {
  name: string;
  sitekey: string;
  secret?: string;
  domains: string[];
};
const widgets = JSON.parse(
  cli(["turnstile", "widget", "list", "--json"])
) as Widget[];
const name = "CyberLab " + environment,
  existing = widgets.filter((widget) => widget.name === name);
if (existing.length > 1)
  throw new Error(
    "Multiple matching widgets; resolve the duplicate names before retrying."
  );
let widget: Widget;
if (existing.length) {
  if (!existing[0].domains.includes(hostname))
    throw new Error(
      "Matching widget has a different hostname; refusing to change it implicitly."
    );
  widget = JSON.parse(
    cli(["turnstile", "widget", "get", existing[0].sitekey, "--json"])
  );
} else
  widget = JSON.parse(
    cli([
      "turnstile",
      "widget",
      "create",
      name,
      "--domain",
      hostname,
      "--mode",
      "managed",
      "--json"
    ])
  );
if (!widget.secret || !widget.sitekey)
  throw new Error("Cloudflare did not return the widget credentials.");
cli(["secret", "put", "TURNSTILE_SECRET"], widget.secret);
widget.secret = undefined;
const parseErrors: ParseError[] = [];
const config = parseJsonc(await readFile(configFile, "utf8"), parseErrors, {
  allowTrailingComma: true
});
if (parseErrors.length)
  throw new Error("The Wrangler configuration is invalid JSONC.");
const deployment = environment === "staging" ? config.env.staging : config;
deployment.vars.TURNSTILE_SITE_KEY = widget.sitekey;
deployment.vars.TURNSTILE_HOSTNAMES = hostname;
deployment.vars.SELF_HOSTS =
  "cyberlab-ar.connecttag.workers.dev,cyberlab-ar-staging.connecttag.workers.dev";
deployment.vars.LIVE_SCAN_ENABLED = "true";
deployment.secrets = { required: ["TURNSTILE_SECRET", "QUOTA_HMAC_SECRET"] };
await writeFile(configFile, JSON.stringify(config, null, 2) + "\n");
console.log(
  JSON.stringify({
    environment,
    hostname,
    sitekey: widget.sitekey,
    secret: "stored in Cloudflare only"
  })
);
