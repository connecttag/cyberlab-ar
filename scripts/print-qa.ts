import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import {
  analyzeHeaders,
  parseHeaders,
  SAMPLE_HEADERS
} from "../packages/core/src/headers";
import { reportHtml, sanitizeReport } from "../packages/core/src/exports";
await mkdir("output/pdf", { recursive: true });
const report = analyzeHeaders({
  url: "https://demo.cyberlab.test/",
  ...parseHeaders(SAMPLE_HEADERS),
  source: "demo"
});
report.author = "CyberLab QA";
report.notes = "مراجعة طباعة تجريبية / Print layout verification";
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const language of ["ar", "en"] as const) {
    const page = await browser.newPage();
    await page.setContent(reportHtml(sanitizeReport(report), language));
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: `output/pdf/print-${language}.pdf`,
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "18mm", left: "15mm", right: "15mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font:9px Arial;color:#657386;text-align:center">CyberLab · <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    });
    await page.close();
  }
} finally {
  await browser.close();
}
