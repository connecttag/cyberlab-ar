# Analysis rule development

Add pure functions to the shared core package. A rule must have a stable ruleId, bilingual title/explanation/remediation, redacted evidence, source references, a confidence classification, and a state: pass, warn, fail, na, or untested.

Distinguish missing evidence from an observed defect. HTML-specific policies do not apply to all API responses. Report-Only CSP is not enforced. Multiple CSP policies intersect. Missing contextual isolation policies are not automatically vulnerabilities. Cookie HttpOnly requirements depend on its purpose. A header-only scan cannot establish CORS exploitation, overall CSP effectiveness, certificate properties, or authenticated-session security.

Use `na` when a rule does not apply and `untested` when required evidence is unavailable. Do not invent a numeric security score or claim site trust from URL shape. Log indicators use documented fixed thresholds and never assert an intrusion.

Version the engine when a rule's interpretation changes. Add fixtures for both positive and negative results, missing evidence, malformed data, contextual applicability, and redaction. Keep network I/O outside pure analysis modules. Update docs and reference links when source guidance changes.

## Log thresholds

- Bursts: at least 30 events/IP in a fixed UTC minute.
- Denials: at least 10 HTTP 401/403 or explicit login_failed events/IP in fixed five-minute periods.
- Server errors: at least 20 events and at least 20% HTTP 5xx in a fixed five-minute period.

Fixed windows are explicit, simple indicators, not a statistical anomaly detector. Original logs are not embedded in reports. Query strings are discarded during parsing.
