import { describe, expect, it, vi } from "vitest";
import {
  isPublicIp,
  validateTarget,
  resolveTarget,
  boundedText,
  ScanError
} from "../../packages/core/src/target";
import { scanWebsite } from "../../apps/scanner/src/scan";
const dns = async () => ({
  addresses: ["8.8.8.8"],
  records: [{ name: "example.com", type: 1, data: "8.8.8.8", TTL: 300 }]
});
describe("target boundary", () => {
  it.each([
    "http://127.0.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "https://metadata.google.internal",
    "http://localhost",
    "http://router.local",
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://example.com:8443"
  ])("rejects %s", (value) =>
    expect(() => validateTarget(value)).toThrow(ScanError)
  );
  it("normalizes targets and blocks self-scans", () => {
    expect(validateTarget("EXAMPLE.com/a#secret").href).toBe(
      "https://example.com/a"
    );
    expect(() =>
      validateTarget("https://app.example.com", ["app.example.com"])
    ).toThrow();
  });
  it.each([
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "127.0.0.2",
    "0.0.0.0",
    "192.0.2.1",
    "224.0.0.1",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "2001:db8::1",
    "::ffff:10.0.0.1"
  ])("blocks non-public address %s", (ip) =>
    expect(isPublicIp(ip)).toBe(false)
  );
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "accepts global unicast %s",
    (ip) => expect(isPublicIp(ip)).toBe(true)
  );
  it("rejects mixed safe and unsafe DNS responses", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        Status: 0,
        Answer: [
          { name: "example.com", type: 1, data: "8.8.8.8", TTL: 60 },
          { name: "example.com", type: 28, data: "::1", TTL: 60 }
        ]
      })
    );
    await expect(resolveTarget("example.com", fetcher)).rejects.toMatchObject({
      code: "BLOCKED_TARGET"
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("caps DNS response bodies", async () => {
    await expect(
      boundedText(new Response("x".repeat(100)), 50)
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
});
describe("outbound scanner", () => {
  it("sends only fixed headers, cancels bodies, and redacts cookies", async () => {
    const cancel = vi.fn();
    const outgoing = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(new ReadableStream({ cancel }), {
          headers: {
            "content-type": "text/html",
            "set-cookie": "session=private; Secure; HttpOnly; SameSite=Lax"
          }
        })
    );
    const report = await scanWebsite("https://example.com", [], outgoing, dns);
    expect(report.source).toBe("live");
    expect(cancel).toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toContain("private");
    const options = outgoing.mock.calls[0][1]!;
    expect(options.redirect).toBe("manual");
    expect(Object.keys(options.headers!)).toEqual(["user-agent", "accept"]);
  });
  it("does not follow a redirect to a private destination", async () => {
    const outgoing = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1" }
        })
    );
    const report = await scanWebsite("https://example.com", [], outgoing, dns);
    expect(report.status).toBe("partial");
    expect(report.findings.at(-1)?.evidence).toBe("BLOCKED_TARGET");
    expect(outgoing).toHaveBeenCalledTimes(1);
  });
  it("checks DNS again on every redirected hostname and rejects changed answers", async () => {
    let index = 0;
    const resolver = vi.fn(async () => {
      if (index++) throw new ScanError("BLOCKED_TARGET");
      return dns();
    });
    const outgoing = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://other.example.com/" }
        })
    );
    const report = await scanWebsite(
      "https://example.com",
      [],
      outgoing,
      resolver
    );
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(outgoing).toHaveBeenCalledTimes(1);
    expect(report.status).toBe("partial");
  });
  it("detects loops", async () => {
    const outgoing = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/" }
        })
    );
    expect(
      (await scanWebsite("https://example.com", [], outgoing, dns)).findings.at(
        -1
      )?.evidence
    ).toBe("REDIRECT_LOOP");
  });
  it("enforces a maximum of five redirects", async () => {
    let i = 0;
    const outgoing = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/" + ++i }
        })
    );
    const report = await scanWebsite("https://example.com", [], outgoing, dns);
    expect(outgoing).toHaveBeenCalledTimes(6);
    expect(report.findings.at(-1)?.evidence).toBe("TOO_MANY_REDIRECTS");
  });
  it("returns a controlled error when the first target cannot be reached", async () => {
    await expect(
      scanWebsite(
        "https://example.com",
        [],
        async () => {
          throw new Error("secret internal error");
        },
        dns
      )
    ).rejects.toMatchObject({ code: "TARGET_UNREACHABLE" });
  });
});
