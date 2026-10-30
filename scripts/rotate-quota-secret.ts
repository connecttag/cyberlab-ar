import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
const environment = process.argv[2];
if (!["staging", "production"].includes(environment))
  throw new Error("Choose staging or production explicitly.");
const args = [
  "node_modules/wrangler/bin/wrangler.js",
  "secret",
  "put",
  "QUOTA_HMAC_SECRET",
  "-c",
  "apps/api/wrangler.jsonc"
];
if (environment === "staging") args.push("--env", "staging");
const result = spawnSync(process.execPath, args, {
  input: randomBytes(48).toString("hex"),
  stdio: ["pipe", "inherit", "inherit"]
});
process.exitCode = result.status ?? 1;
