import { scanWebsite } from "./scan";
import { ScanError } from "@cyberlab/core/target";
import { z } from "zod";
const input = z
  .object({
    url: z.string().max(4096),
    selfHosts: z.array(z.string().max(255)).max(20)
  })
  .strict();
export default {
  async fetch(request: Request, env: ScannerEnv): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/scan")
      return new Response(null, { status: 404 });
    try {
      if (Number(request.headers.get("content-length") ?? 0) > 8192)
        return Response.json(
          { error: { code: "INVALID_REQUEST" } },
          { status: 413 }
        );
      const parsed = input.safeParse(JSON.parse(await request.text()));
      if (!parsed.success)
        return Response.json(
          { error: { code: "INVALID_REQUEST" } },
          { status: 400 }
        );
      const result = await scanWebsite(parsed.data.url, [
        ...parsed.data.selfHosts,
        ...env.SELF_HOSTS.split(",").filter(Boolean)
      ]);
      return Response.json(result, {
        headers: { "cache-control": "no-store" }
      });
    } catch (error) {
      const failure =
        error instanceof ScanError
          ? error
          : new ScanError("TARGET_UNREACHABLE", 502);
      return Response.json(
        { error: { code: failure.code } },
        { status: failure.httpStatus }
      );
    }
  }
} satisfies ExportedHandler<ScannerEnv>;
