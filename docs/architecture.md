# Architecture and privacy

## Boundaries

The React/Vite frontend lazy-loads tools. Shared TypeScript modules implement deterministic header, URL, log, and report behavior. API routes use Hono and Zod. The scanner has no public route, secrets, or database binding. Only the public API can invoke its service binding.

Local analysis never sends imported HAR files, log files, QR images, browser observations, or report content to an API. The UI explains the separate network behavior of live audits. No visitor accounts, cloud reports, share tokens, or admin UI exist.

## Outbound requests

Only HTTP/HTTPS default ports and DNS hostnames are accepted for live scans. Literal IPs, credentials, private/reserved results, and configured self-hosts are refused. Every redirect is validated and resolved again. Redirects are manual; at most five are followed. Response bodies are cancelled. Only security-related observations are returned; Set-Cookie values are never included.

Preflight DNS validation is not DNS pinning. Workers' `global_fetch_strictly_public` flag and the scanner's lack of origin/private bindings provide the runtime boundary for public egress. Validate this assumption again before adapting this service to another runtime or adding private/origin bindings. Local tests use injected fetch/DNS transports rather than introducing a production private-network bypass.

## Quotas

Each conditional SQLite UPSERT reserves a slot atomically. Limits are checked sequentially: per-source minute, per-source day, per-host minute, then global day. A rejected attempt can consume an earlier slot; it never causes a later limit to be exceeded. HMAC subjects include the window and scope, so raw source addresses or destination names are not persisted. Expired rows are removed hourly. Quota or challenge failures stop live scanning.

A separate 20/source/minute counter bounds invalid challenge submissions before Siteverify. Scan quota is reserved only after successful token, hostname, and action verification. Configuration advertises live availability only when the switch, public key, required secrets, and request hostname are ready.

## Reports and local persistence

Version 1 reports have a strict Zod schema. Findings have stable rule IDs, explicit applicability states, bilingual descriptions, redacted evidence, remediation, and references. No overall security score is generated. The report studio warns about target/tool or engine-version mismatches.

IndexedDB saves are explicit, expire in 30 days, and are bounded to 100 reports or 25 MiB. Raw log files and QR images remain transient. Export supports redaction previews, optional IP masking, escaped standalone HTML, quoted and formula-protected CSV, and local print-to-PDF. Automatic redaction is an aid; users must review evidence and free-form notes.

## Maintenance

Secrets are stored using Wrangler secret input, never in source or command arguments. Structured application logs contain event codes, status, and duration only. Invocation logs are disabled. Cloudflare account-level logging, recovery, and retention policies are separate from application data handling.
