import { describe, expect, it } from "vitest";
import {
  analyzeHeaders,
  parseHeaders,
  parseHar,
  SAMPLE_HEADERS
} from "../../packages/core/src/headers";
import { analyzeUrl } from "../../packages/core/src/urls";
import { compareReports, reportSchema } from "../../packages/core/src/report";
import {
  combineReports,
  parseReports,
  reportCsv,
  reportHtml,
  sanitizeReport
} from "../../packages/core/src/exports";
import { csvCell, redactUrl } from "../../packages/core/src/redact";
import {
  defaultMapping,
  filterLogs,
  parseLogLine,
  sampleLogs,
  summarizeLogs
} from "../../packages/core/src/logs";
const report = () =>
  analyzeHeaders({
    url: "https://example.com/",
    ...parseHeaders(SAMPLE_HEADERS)
  });
describe("security headers", () => {
  it("keeps duplicate cookies and commas in Expires, without returning values", () => {
    const r = report();
    expect(
      r.findings.filter((x) => x.ruleId.startsWith("web.cookie."))
    ).toHaveLength(2);
    expect(JSON.stringify(r)).not.toContain("demo-value");
    expect(r.findings.find((x) => x.ruleId === "web.cookie.0")?.state).toBe(
      "fail"
    );
    expect(
      r.findings.find((x) => x.ruleId === "web.cookie.1")?.evidence
    ).toContain("Expires=Wed, 09 Jun");
    expect(reportSchema.safeParse(r).success).toBe(true);
  });
  it("does not treat report-only CSP as enforced", () =>
    expect(
      report().findings.find((x) => x.ruleId === "web.csp.present")?.state
    ).toBe("fail"));
  it("detects disabled HSTS", () =>
    expect(report().findings.find((x) => x.ruleId === "web.hsts")?.state).toBe(
      "fail"
    ));
  it("does not apply HTML-only policies to JSON APIs", () => {
    const r = analyzeHeaders({
      url: "http://example.com/",
      headers: [["content-type", "application/json"]]
    });
    expect(r.findings.find((x) => x.ruleId === "web.csp.present")?.state).toBe(
      "na"
    );
    expect(r.findings.find((x) => x.ruleId === "web.hsts")?.state).toBe("na");
    expect(r.findings.find((x) => x.ruleId === "web.framing")?.state).toBe(
      "na"
    );
  });
  it("marks unknown response contexts as untested", () => {
    const r = analyzeHeaders({ url: "https://example.com", headers: [] });
    expect(r.status).toBe("partial");
    expect(r.findings.find((x) => x.ruleId === "web.csp.present")?.state).toBe(
      "untested"
    );
  });
  it("uses enforced frame-ancestors even when XFO is missing", () => {
    const r = analyzeHeaders({
      url: "https://example.com",
      headers: [
        ["content-type", "text/html"],
        [
          "content-security-policy",
          "default-src 'self'; frame-ancestors 'none'"
        ]
      ]
    });
    expect(r.findings.find((x) => x.ruleId === "web.framing")?.state).toBe(
      "pass"
    );
  });
  it("handles multiple CSP and nonces without a false inline failure", () => {
    const r = analyzeHeaders({
      url: "https://example.com",
      headers: [
        ["content-type", "text/html"],
        ["content-security-policy", "script-src 'nonce-demo' 'unsafe-inline'"],
        ["content-security-policy", "object-src 'none'"]
      ]
    });
    expect(
      r.findings.find((x) => x.ruleId === "web.csp.directives")?.state
    ).toBe("pass");
  });
  it("detects downgrade redirects", () => {
    const r = analyzeHeaders({
      url: "http://example.com",
      headers: [],
      redirects: [
        {
          url: "https://example.com",
          status: 302,
          location: "http://example.com"
        }
      ]
    });
    expect(
      r.findings.some(
        (x) =>
          x.ruleId.startsWith("web.redirect.downgrade") && x.state === "fail"
      )
    ).toBe(true);
  });
  it("reports malformed lines and accepts CRLF", () => {
    const parsed = parseHeaders(
      "HTTP/1.1 201 Created\r\nX-Test: a\r\nnot a header\r\n"
    );
    expect(parsed.status).toBe(201);
    expect(parsed.invalid).toBe(1);
    expect(parsed.headers).toEqual([["x-test", "a"]]);
  });
  it("imports only response headers from HAR, not request credentials or bodies", () => {
    const har = {
      log: {
        entries: [
          {
            request: {
              url: "https://example.com",
              headers: [{ name: "Authorization", value: "Bearer secret" }]
            },
            response: {
              status: 200,
              headers: [{ name: "Content-Type", value: "text/html" }],
              content: { text: "private body" }
            }
          }
        ]
      }
    };
    const values = parseHar(JSON.stringify(har));
    expect(values).toHaveLength(1);
    expect(JSON.stringify(values)).not.toContain("Bearer");
    expect(JSON.stringify(values)).not.toContain("private body");
  });
  it("rejects invalid HAR", () =>
    expect(() => parseHar("{}")).toThrow("INVALID_HAR"));
});
describe("URL analysis", () => {
  it("uses the public suffix list for multi-label suffixes", () => {
    const r = analyzeUrl(
      "https://login.shop.example.co.uk/path?token=secret&lang=ar"
    );
    expect(r.observations.find((x) => x.key === "domain")?.value).toBe(
      "example.co.uk"
    );
    expect(JSON.stringify(r)).not.toContain("token=secret");
    expect(r.target).toContain("REDACTED");
  });
  it("exposes ASCII and Unicode hostnames", () => {
    const r = analyzeUrl("https://xn--mgbh0fb.xn--kgbechtv/");
    expect(r.observations.find((x) => x.key === "unicode")?.value).toContain(
      "مثال"
    );
  });
  it("hides URL credentials and flags their presence", () => {
    const r = analyzeUrl("https://person:supersecret@example.com/");
    expect(JSON.stringify(r)).not.toContain("supersecret");
    expect(JSON.stringify(r)).not.toContain("person");
    expect(r.findings.find((x) => x.ruleId === "url.credentials")?.state).toBe(
      "warn"
    );
  });
  it("does not open or fetch non-http schemes", () => {
    const r = analyzeUrl("javascript:alert(1)");
    expect(r.findings.find((x) => x.ruleId === "url.scheme")?.state).toBe(
      "warn"
    );
  });
  it("rejects malformed URLs", () =>
    expect(() => analyzeUrl("https://[")).toThrow("INVALID_URL"));
});
describe("logs", () => {
  it("parses Combined Log with an explicit offset", () => {
    const r = parseLogLine(
      '203.0.113.4 - - [30/Oct/2026:12:00:00 +0300] "GET /api?token=secret HTTP/1.1" 403 12 "-" "agent"',
      "combined"
    );
    expect(new Date(r.time).toISOString()).toBe("2026-10-30T09:00:00.000Z");
    expect(r.path).toBe("/api");
  });
  it("uses the chosen zone for timestamps without an offset", () => {
    const r = parseLogLine(
      JSON.stringify({
        timestamp: "2026-10-30T12:00:00",
        status: 200,
        path: "/"
      }),
      "jsonl",
      defaultMapping,
      "Asia/Riyadh"
    );
    expect(new Date(r.time).toISOString()).toBe("2026-10-30T09:00:00.000Z");
  });
  it("preserves explicit offsets regardless of selected zone", () => {
    const r = parseLogLine(
      '{"timestamp":"2026-10-30T12:00:00+03:00","status":200}',
      "jsonl",
      defaultMapping,
      "America/New_York"
    );
    expect(new Date(r.time).toISOString()).toBe("2026-10-30T09:00:00.000Z");
  });
  it("preserves fractional seconds and rejects invalid calendar dates", () => {
    const r = parseLogLine(
      '{"timestamp":"2026-10-30T12:00:00.123","status":200}',
      "jsonl",
      defaultMapping,
      "Asia/Riyadh"
    );
    expect(new Date(r.time).toISOString()).toBe("2026-10-30T09:00:00.123Z");
    expect(() =>
      parseLogLine('{"timestamp":"2026-02-30T12:00:00"}', "jsonl")
    ).toThrow();
  });
  it("keeps all events in a bounded timeline across long date ranges", () => {
    const events = Array.from({ length: 500 }, (_, i) => ({
      time: Date.UTC(2026, 0, 1) + i * 86400000,
      ip: "203.0.113.1",
      path: "/",
      status: 200,
      event: "http"
    }));
    const summary = summarizeLogs(events);
    expect(summary.timeline.length).toBeLessThanOrEqual(120);
    expect(summary.timeline.reduce((sum, item) => sum + item.count, 0)).toBe(
      500
    );
  });
  it("supports mapped nested fields and rejects prototype paths", () => {
    const mapping = { ...defaultMapping, time: "meta.time" };
    expect(
      parseLogLine('{"meta":{"time":"2026-10-30T12:00:00Z"}}', "jsonl", mapping)
        .status
    ).toBe(0);
    expect(() =>
      parseLogLine("{}", "jsonl", { ...mapping, time: "__proto__.time" })
    ).toThrow();
  });
  it("summarizes thresholds as review indicators", () => {
    const entries = sampleLogs()
      .split("\n")
      .map((line) => parseLogLine(line, "jsonl"));
    const result = summarizeLogs(entries, 2, ["line invalid"]);
    expect(result.total).toBe(80);
    expect(result.invalid).toBe(2);
    expect(
      result.report.findings.find((x) => x.ruleId === "logs.burst")?.state
    ).toBe("warn");
    expect(
      result.report.findings.find((x) => x.ruleId === "logs.errors")?.state
    ).toBe("warn");
    expect(filterLogs(entries, { status: "5" })).toHaveLength(22);
    expect(
      result.report.observations.some((x) => x.key.startsWith("ip."))
    ).toBe(true);
  });
  it("rejects overlong or invalid records", () => {
    expect(() => parseLogLine("x".repeat(65537), "combined")).toThrow();
    expect(() => parseLogLine('{"timestamp":"wrong"}', "jsonl")).toThrow();
  });
});
describe("reports and exports", () => {
  it("escapes HTML in all report fields and blocks active reference schemes", () => {
    const r = report();
    r.notes = "<script>alert(1)</script>";
    r.author = "<img src=x onerror=alert(1)>";
    const html = reportHtml(r, "ar");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("Content-Security-Policy");
  });
  it.each(["=SUM(A1)", " +123", "@command", "\t-12"])(
    "protects CSV formulas: %s",
    (value) => expect(csvCell(value)).toMatch(/^"'/)
  );
  it("quotes CSV strings and emits a UTF-8 BOM", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(reportCsv(report(), "ar").charCodeAt(0)).toBe(0xfeff);
  });
  it("round-trips versioned JSON and rejects unknown or invalid fields", () => {
    expect(parseReports(JSON.stringify(report()))).toHaveLength(1);
    expect(() => parseReports('{"schemaVersion":99}')).toThrow(
      "INVALID_REPORT"
    );
    expect(() =>
      parseReports(JSON.stringify({ ...report(), unexpected: "value" }))
    ).toThrow();
  });
  it("redacts tokens and masks addresses", () => {
    const r = report();
    r.notes = "https://example.com/?access_token=private 203.0.113.12";
    const redacted = sanitizeReport(r);
    expect(redacted.notes).not.toContain("private");
    expect(redacted.notes).toContain("203.0.113.x");
    expect(
      redactUrl("https://a:b@example.com/?password=private")
    ).not.toContain("private");
  });
  it("combines reports and preserves child provenance", () => {
    const r = combineReports(
      [report(), analyzeUrl("https://example.com")],
      "Review",
      "Analyst",
      "Notes"
    );
    expect(r.toolId).toBe("bundle");
    expect(r.observations.find((x) => x.key === "source.0")?.value).toContain(
      "1.0.0"
    );
    expect(reportSchema.safeParse(r).success).toBe(true);
  });
  it("separates rule-version changes from observed differences", () => {
    const before = report(),
      after = structuredClone(before);
    after.engineVersion = "2.0.0";
    after.findings[0].state = "pass";
    const diff = compareReports(before, after);
    expect(diff.compatible).toBe(true);
    expect(diff.rulesChanged).toBe(true);
    expect(diff.changed).toHaveLength(1);
  });
  it("marks abbreviated bundles as partial and explains the omitted evidence", () => {
    const child = report();
    child.findings = Array.from({ length: 190 }, (_, i) => ({
      ...child.findings[0],
      ruleId: "fixture." + i
    }));
    const bundle = combineReports([child, report()], "Review", "", "");
    expect(bundle.status).toBe("partial");
    expect(
      bundle.limitations.some((item) => item.en.includes("abbreviated"))
    ).toBe(true);
    expect(reportSchema.safeParse(bundle).success).toBe(true);
  });
});
