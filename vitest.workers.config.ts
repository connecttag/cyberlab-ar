import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { analyzeHeaders } from "./packages/core/src/headers";
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "apps/api/wrangler.jsonc" },
      miniflare: {
        serviceBindings: {
          SCANNER: async () =>
            Response.json(
              analyzeHeaders({
                url: "https://example.com/",
                headers: [["content-type", "text/html"]],
                source: "live"
              })
            )
        }
      }
    })
  ],
  test: { include: ["tests/workers/**/*.test.ts"] }
});
