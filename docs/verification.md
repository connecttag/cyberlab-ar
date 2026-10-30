# Verification record

Implementation date: 2026-10-30 (Asia/Riyadh).

Report schema: 1. Analysis engine/build: 1.0.0. Repository: `cyberlab-ar`, branch `codex/cyberlab-initial`.

## Local checks

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | Passed | Web/core, Workers, and maintenance/QA scripts |
| Core/network tests | 72 passed | Headers, CSP applicability, repeated headers/cookies, PSL/IDNs/URL indicators, redaction, exports, log parsing/time zones, report comparison and abbreviated bundles, SSRF and redirect/DNS fixtures |
| Workers integration | 18 passed | Actual local D1 transactions/concurrency/expiry, pseudonyms, API schema/body/origin checks, Siteverify host/action/failed/success fixtures, fail-closed behavior, pre-verification throttling, static SPA responses |
| Browser | 22 passed | Desktop Chrome and emulated Pixel 7; 11 scenarios in both profiles |
| Production build | Passed | Lazy-loaded tools, log/QR workers, OpenAPI document and static-only service worker generated |
| Dependency audit | 0 known vulnerabilities | Full npm audit of the locked dependency graph on this date |

Commands: `npm run check`, `npm run test:browser`, `npm audit --json`. Runtime: Node 24.22.1 using the documented Windows wrapper. The report-studio browser scenario was repeated on both profiles after the final bundle-size safeguard. The required-secret warning during local Worker tests is expected: fixtures supply test bindings without storing real secrets. Vite currently warns about a future native configuration-loader change; today's build and test configurations pass.

Browser scenarios cover RTL/LTR, theme persistence, phone overflow, local header samples and hidden cookie values, link/QR processing without target navigation/upload, browser properties without permission requests, log Worker/filter/CSV, invalid records and zone mapping, report import/export escaping, denied IndexedDB, offline PWA excluding API cache, cancellation during a large log import, and simulated Turnstile callback/submission/reset. They verify app behavior, not the real Turnstile challenge service.

## Print inspection

`scripts/print-qa.ts` generated sample Arabic and English A4 PDFs using Chrome. All pages were rasterized with Poppler and visually reviewed. Both final samples have seven pages, with readable Arabic, isolated LTR URLs/code, repeated table headings, wrapped evidence, and no blank trailing page. Original findings may span pages to keep long remediation examples readable. These are internal sample artifacts under ignored `output/pdf/`; visitors generate PDFs locally through their browser's print dialog.

## Published verification

- Production: https://cyberlab-ar.connecttag.workers.dev
- Staging: https://cyberlab-ar-staging.connecttag.workers.dev
- Production private scanner: `cyberlab-ar-scanner`; staging: `cyberlab-ar-scanner-staging`.
- Final app deployment IDs: production `1b31c7b7-1137-4b1a-b2b2-44be9a615fe8`; staging `78cf71d0-b608-4c40-b8c3-ac73c058de70`. Scanner IDs: production `6ef00309-ed3e-4788-934b-ab55a7bea482`; staging `bd881643-e51b-4d6d-8bb9-2fe18a4a9e44`. Wrangler observed app startup times of 23 ms and 20 ms respectively; these are deployment startup observations, not visitor latency benchmarks.
- D1 databases and Turnstile widgets are independent between the two environments. Both quota migrations were applied remotely; secrets were streamed into Cloudflare without printing or saving the widget secrets.
- Both actual published frontends rendered the Arabic overview. `/healthz` returned HTTP 200 with `status: ok`; `/api/v1/config` reported live availability. An intentionally invalid token sent to production returned HTTP 403 / `CHALLENGE_REJECTED`.
- A read-only aggregate check of production D1 found two counters and zero malformed hash keys: every stored key was a 64-character hexadecimal digest. The table schema contains only `key_hash`, `count`, and `expires_at`; no raw source address, URL, or report column exists.
- A temporary authenticated, fixed-target QA Worker invoked the **deployed staging scanner through its private binding**. example.com returned an HTTP 200 response and a schema-valid `complete` report with eight observations and ten findings. `http://127.0.0.1/` returned HTTP 422 / `BLOCKED_TARGET`; an unknown private route returned 404. The temporary QA Worker and browser session were removed afterward. This test did not alter or bypass validation on the public application.
- A real Managed Turnstile widget loaded on staging. With the user's action-time approval, one checkbox click was performed. The browser did not receive a valid response token and the UI displayed verification rejection. No further challenge was solved or retried automatically. Therefore a successful **public browser → real Turnstile → API → scanner** scan is still unqualified. Server-side success/failure/hostname/action behavior passes local integration tests; that is separate evidence.

The development machine could resolve api.cloudflare.com but not workers.dev or the public test/DNS hosts. Real public UI verification therefore used bounded Cloudflare Browser Run sessions, without adding Browser Run as an application dependency. A local remote-binding development probe returned an opaque 500 even for an unknown scanner route; the separate deployed binding test above established that the real scanner transport and analysis work. Do not infer a deployed scanner failure from that development transport result.

Screenshots and JSON evidence are in ignored `output/verification/`; local browser evidence is in `output/playwright/`. They contain demonstration inputs only. Automated runs never receive or print Cloudflare credentials in browser/page content.

## Remaining qualification and limits

1. Complete one normal-browser scan with a real, accepted human challenge before treating the public end-to-end path as accepted. Keep Turnstile enabled.
2. Phone tests use emulation; real Android/iOS devices, Safari/Firefox, screen readers, exhaustive contrast/accessibility auditing, and low-memory/long-running benchmarks have not been qualified.
3. Network defenses were exercised with deterministic rebinding/mixed-DNS/redirect fixtures and an actual deployed private-target rejection. This is not a full adversarial production penetration test. Workers public-egress behavior remains part of the documented runtime boundary.
4. Oversized/broken inputs, worker cancellation, and denied storage are covered; actual browser disk exhaustion, every valid/invalid QR image variant, and every historical schema migration are not exhaustively tested. Only report schema 1 is accepted; unsupported reports fail clearly.
5. Enable account usage alerts in Cloudflare before promotion to a broadly advertised public service. Application quotas do not cap spending across the whole account. No billing alert was configured by this implementation.

Header scans do not audit certificate expiry/cipher suites, run target scripts, crawl pages, authenticate, or establish overall site safety. URL and log results remain contextual indicators. Reports and visitor files are not stored in the cloud; account-level operational data handling is documented separately in `architecture.md`.
