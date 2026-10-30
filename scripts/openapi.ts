import { mkdir, writeFile } from "node:fs/promises";
import { app } from "../apps/api/src/index";
await mkdir("docs", { recursive: true });
await writeFile(
  "docs/openapi.json",
  JSON.stringify(
    app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "CyberLab API", version: "1.0.0" }
    }),
    null,
    2
  ) + "\n"
);
