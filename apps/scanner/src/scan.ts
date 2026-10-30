import {
  analyzeHeaders,
  type HeaderPair,
  type RedirectHop
} from "@cyberlab/core/headers";
import { bi, finding, type Report } from "@cyberlab/core/report";
import {
  resolveTarget,
  ScanError,
  validateTarget,
  type DnsSnapshot
} from "@cyberlab/core/target";
export type OutboundFetch = (
  url: string,
  init?: RequestInit
) => Promise<Response>;
export async function scanWebsite(
  raw: string,
  selfHosts: string[],
  outbound: OutboundFetch = fetch,
  resolver: (host: string, signal: AbortSignal) => Promise<DnsSnapshot> = (
    host,
    signal
  ) => resolveTarget(host, outbound, signal)
): Promise<Report> {
  const started = Date.now(),
    deadline = AbortSignal.timeout(20000);
  let url = validateTarget(raw, selfHosts);
  const visited = new Set<string>(),
    redirects: RedirectHop[] = [];
  let previous:
    | { url: string; headers: HeaderPair[]; status: number; dns: DnsSnapshot }
    | undefined;
  try {
    for (let index = 0; index <= 5; index++) {
      if (visited.has(url.href)) throw new ScanError("REDIRECT_LOOP");
      visited.add(url.href);
      const signal = AbortSignal.any([deadline, AbortSignal.timeout(5000)]);
      const dns = await resolver(url.hostname, signal);
      if (deadline.aborted) throw new ScanError("TIMEOUT", 504);
      const response = await outbound(url.href, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: {
          "user-agent": "CyberLab/1.0 (+security-settings-audit)",
          accept:
            "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5"
        },
        signal
      });
      const pairs: HeaderPair[] = [];
      let size = 0;
      for (const [name, value] of response.headers) {
        size += new TextEncoder().encode(name + value).length;
        if (size > 65536) {
          await response.body?.cancel();
          throw new ScanError("RESPONSE_TOO_LARGE");
        }
        if (name !== "set-cookie") pairs.push([name, value]);
      }
      for (const value of response.headers.getSetCookie())
        pairs.push(["set-cookie", value]);
      await response.body?.cancel();
      previous = {
        url: url.href,
        headers: pairs,
        status: response.status,
        dns
      };
      const redirect = [301, 302, 303, 307, 308].includes(response.status),
        location = response.headers.get("location");
      if (redirect && location) {
        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          throw new ScanError("INVALID_REDIRECT");
        }
        redirects.push({
          url: url.href,
          status: response.status,
          location: next.href
        });
        if (index === 5) throw new ScanError("TOO_MANY_REDIRECTS");
        url = validateTarget(next.href, selfHosts);
        continue;
      }
      return analyzeHeaders({
        url: url.href,
        headers: pairs,
        status: response.status,
        elapsed: Date.now() - started,
        redirects,
        dns: dns.records,
        source: "live"
      });
    }
    throw new ScanError("TOO_MANY_REDIRECTS");
  } catch (error) {
    const code =
      error instanceof ScanError
        ? error.code
        : deadline.aborted ||
            (error instanceof Error && /timeout|abort/i.test(error.name))
          ? "TIMEOUT"
          : "TARGET_UNREACHABLE";
    if (!previous) throw new ScanError(code, code === "TIMEOUT" ? 504 : 422);
    const report = analyzeHeaders({
      url: previous.url,
      headers: previous.headers,
      status: previous.status,
      elapsed: Date.now() - started,
      redirects,
      dns: previous.dns.records,
      source: "live"
    });
    report.status = "partial";
    report.findings.push(
      finding(
        "web.transport.incomplete",
        "untested",
        bi("لم تكتمل سلسلة الاتصال", "Connection chain incomplete"),
        code,
        bi(
          "النتائج تخص آخر استجابة تم الوصول إليها؛ الوجهة النهائية لم تُفحص.",
          "Results cover the last reachable response; the final destination was not audited."
        )
      )
    );
    return report;
  }
}
