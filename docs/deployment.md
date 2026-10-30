# Deployment and rollback

## Prerequisites

Use Node 24 LTS, `npm ci`, and a Cloudflare account with Workers/D1 write access. Turnstile creation additionally requires the challenge-widget/Turnstile edit permission; a Workers OAuth session alone may not contain it.

Before re-running resource creation, inspect `wrangler d1 list --json` and the existing deployment state. Database identifiers in the config are non-secret but must name this project's own database. Use different databases for staging and production.

## First deployment

1. Complete `npm run check` and `npm run test:browser`.
2. Create the project's quota database using `wrangler d1 create cyberlab-ar-quota-db`; insert the returned ID in the API config. For staging, create `cyberlab-ar-quota-staging-db` and update the staging binding instead.
3. Apply `wrangler d1 migrations apply QUOTAS --remote -c apps/api/wrangler.jsonc` (add `--env staging` for staging).
4. Deploy the scanner first, with `npm run deploy:scanner` (or Wrangler `--env staging`). Keep `workers_dev` and preview URLs disabled for it.
5. For a **new Worker only**, temporarily set `secrets.required=[]` and `LIVE_SCAN_ENABLED=false` for the selected environment. Deploy the app and capture its actual workers.dev hostname. Wrangler cannot require secrets on a Worker that does not exist yet. Keep the scanner private throughout bootstrap.
6. Set an independent HMAC secret using `npx tsx scripts/rotate-quota-secret.ts staging` (or `production`). Then run `npx tsx scripts/configure-turnstile.ts staging cyberlab-ar-staging.connecttag.workers.dev` with the exact environment and hostname. This creates or reuses the matching Managed widget, streams its secret into Wrangler, and restores the two required-secret names in config. It does not deploy the changed config. Native widget JSON contains a secret: do not run widget get/create into terminal output or files. The helper captures it only in memory and disables Wrangler disk logs.
7. Set `TURNSTILE_HOSTNAMES` and `SELF_HOSTS` to the actual hosts. Include staging and production in the self-host denylist. Set `LIVE_SCAN_ENABLED=true` only after both secrets and the quota migration are verified.
8. Re-deploy, inspect `/healthz` and `/api/v1/config`, then exercise Turnstile in a browser and scan a controlled public target.

The application can be published with local tools available while the live scanner remains explicitly unavailable. Never substitute Turnstile testing keys or bypass validation in a public deployment.

## Local development

The local database and service bindings are simulated. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` only for testing configured live behavior. Published config contains real public keys, but readiness remains false locally without secrets and an explicitly allowed hostname. Never use production secrets for local tests. Unit tests inject transports; Worker tests simulate Siteverify and exercise real D1 locally. Configure a separate development Origin deliberately if exposing API through a different port; production accepts same-origin browser requests only.

## Deployed verification

`scripts/verify-remote-browser.ts --production --observe-only` checks the real UI, health, readiness, and rejection of an invalid challenge token. The default environment is staging. The optional `--interactive` mode waits for an operator command and requires explicit human approval immediately before any CAPTCHA interaction. It never solves or retries challenges on its own.

`scripts/verify-deployed-scanner.ts` creates a temporary authenticated QA Worker with a **fixed** example.com target, invokes the staging scanner through its private binding, checks private-target rejection, and deletes the QA Worker in `finally`. It never changes the app's Turnstile requirement. Only run this helper deliberately; it deploys a temporary resource and uses Cloudflare Browser Run. These QA helpers are not visitor dependencies and can incur small account usage. They read the existing Wrangler OAuth credential in memory and send it only to api.cloudflare.com. Use an ordinary local browser instead when the machine can resolve workers.dev. `verify-edge-scanner.ts` is a lighter remote-binding probe; its development transport is unavailable on the current machine.

Run argument-bearing TypeScript helpers using `npx tsx scripts/name.ts ...` or Node plus the local tsx CLI. Do not pass their arguments as npm configuration options.

## Operational controls

Quota defaults: 5/IP/minute, 50/IP/day, 10/host/minute, 1000/day globally; challenge submissions are also limited to 20/IP/minute before Siteverify. Staging global default is 100/day. Adjust only through config/redeployment. `LIVE_SCAN_ENABLED=false` is the emergency stop; local tools continue to work.

Set account usage alerts before public release. Project quotas are not an account-wide billing ceiling. Check Workers errors/duration and D1 utilization in Cloudflare's dashboard. Do not enable request-body or report logging.

## Rollback

Keep the previous Worker version available. Disable live scans first if a scanner issue is suspected, then roll back scanner/app versions as appropriate. Migration 0001 is additive and compatible with previous code; future migrations must retain backward compatibility during rollout. Rolling back an application version does not restore reports because reports are never stored server-side.
