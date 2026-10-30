// Optional, short-lived deployment QA. This is never an application route.
// The target is fixed; this worker cannot accept URLs or forward caller input.
export default {
  async fetch(request: Request, env: { SCANNER: Fetcher; QA_GATE?: string }) {
    if (
      !env.QA_GATE ||
      request.headers.get("authorization") !== "Bearer " + env.QA_GATE
    )
      return new Response(null, { status: 403 });
    const unreachableRoute = await env.SCANNER.fetch(
      "https://scanner.internal/probe"
    );
    const blocked = await env.SCANNER.fetch("https://scanner.internal/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1/", selfHosts: [] })
    });
    const scan = await env.SCANNER.fetch("https://scanner.internal/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/", selfHosts: [] })
    });
    return Response.json(
      {
        transportProbe: unreachableRoute.status,
        blocked: { status: blocked.status, result: await blocked.json() },
        scan: { status: scan.status, result: await scan.json() }
      },
      { headers: { "cache-control": "no-store" } }
    );
  }
};
