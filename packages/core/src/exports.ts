import {
  bi,
  reportSchema,
  makeReport,
  observation,
  type Language,
  type Report
} from "./report";
import { csvCell, escapeHtml, maskIp, redactText, redactUrl } from "./redact";
export function sanitizeReport(report: Report, maskAddresses = true): Report {
  const copy = structuredClone(report);
  const clean = (v: string) =>
    maskAddresses ? maskIp(redactText(v)) : redactText(v);
  copy.target = clean(redactUrl(copy.target));
  copy.notes = clean(copy.notes);
  copy.author = clean(copy.author);
  copy.title = { ar: clean(copy.title.ar), en: clean(copy.title.en) };
  for (const o of copy.observations) {
    if (typeof o.value === "string") o.value = clean(o.value);
    o.label = { ar: clean(o.label.ar), en: clean(o.label.en) };
  }
  for (const f of copy.findings) {
    f.evidence = clean(f.evidence);
    f.title = { ar: clean(f.title.ar), en: clean(f.title.en) };
    f.explanation = {
      ar: clean(f.explanation.ar),
      en: clean(f.explanation.en)
    };
    f.remediation = {
      ar: clean(f.remediation.ar),
      en: clean(f.remediation.en)
    };
    f.snippets = f.snippets.map((s) => ({ ...s, code: clean(s.code) }));
    f.references = f.references
      .filter((x) => /^https?:\/\//i.test(x))
      .map(redactUrl);
  }
  return copy;
}
export function parseReports(text: string): Report[] {
  if (text.length > 8 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("INVALID_REPORT");
  }
  const values = Array.isArray(json) ? json : [json];
  if (values.length > 20) throw new Error("TOO_MANY_REPORTS");
  const result = values.map((x) => reportSchema.safeParse(x));
  if (result.some((x) => !x.success)) throw new Error("INVALID_REPORT");
  return result.map((x) => sanitizeReport(x.data!, false));
}
export function combineReports(
  reports: Report[],
  title: string,
  author: string,
  notes: string
): Report {
  if (!reports.length) throw new Error("NO_REPORTS");
  const r = makeReport("bundle", bi(title, title), "", "local");
  r.author = author;
  r.notes = notes;
  let truncated = false;
  reports.forEach((child, index) => {
    if (
      child.observations.length > Math.floor(400 / reports.length) ||
      child.findings.length > Math.floor(180 / reports.length)
    )
      truncated = true;
    r.observations.push(
      observation(
        "source." + index,
        bi("مصدر التقرير", "Report source"),
        `${child.title.en} | ${child.createdAt} | ${child.engineVersion} | ${child.target}`
      )
    );
    r.observations.push(
      ...child.observations
        .slice(0, Math.floor(400 / reports.length))
        .map((x) => ({ ...x, key: index + "." + x.key }))
    );
    r.findings.push(
      ...child.findings
        .slice(0, Math.floor(180 / reports.length))
        .map((x) => ({ ...x, ruleId: index + "." + x.ruleId }))
    );
    r.limitations.push(...child.limitations);
  });
  const limitations = [
    ...new Map(r.limitations.map((x) => [x.en, x])).values()
  ];
  if (limitations.length > 40) truncated = true;
  r.limitations = limitations.slice(0, truncated ? 39 : 40);
  if (truncated)
    r.limitations.push(
      bi(
        "التقرير المجمّع مختصر لتلبية حدود الحجم. احتفظ بالتقارير الأصلية لمراجعة جميع الملاحظات والأدلة.",
        "The combined report is abbreviated to meet size limits. Keep the original reports to review every finding and observation."
      )
    );
  if (truncated || reports.some((x) => x.status !== "complete"))
    r.status = "partial";
  return r;
}
const stateNames = {
  ar: {
    pass: "ناجح",
    warn: "ملاحظة",
    fail: "يحتاج معالجة",
    na: "غير منطبق",
    untested: "لم يُفحص"
  },
  en: {
    pass: "Pass",
    warn: "Review",
    fail: "Needs attention",
    na: "Not applicable",
    untested: "Not tested"
  }
};
const priorityNames = {
  ar: { info: "معلوماتي", low: "منخفضة", medium: "متوسطة", high: "مرتفعة" },
  en: { info: "Informational", low: "Low", medium: "Medium", high: "High" }
};
const reportStates = {
  ar: { complete: "مكتمل", partial: "جزئي", failed: "تعذر" },
  en: { complete: "Complete", partial: "Partial", failed: "Failed" }
};
export function reportMarkdown(r: Report, lang: Language): string {
  const safe = (s: string) => s.replace(/([\\`*_{}\[\]<>])/g, "\\$1");
  return [
    `# ${safe(r.title[lang])}`,
    `${r.createdAt} · ${r.engineVersion}`,
    safe(r.target),
    safe(r.author),
    safe(r.notes),
    "",
    ...r.observations.map(
      (x) => `- **${safe(x.label[lang])}:** ${safe(String(x.value ?? "—"))}`
    ),
    "",
    ...r.findings.flatMap((f) => [
      `## ${safe(f.title[lang])}`,
      `${stateNames[lang][f.state]} · ${priorityNames[lang][f.priority]}`,
      safe(f.explanation[lang]),
      `> ${safe(f.evidence).replace(/\n/g, "\n> ")}`,
      safe(f.remediation[lang]),
      ...f.references.map((x) => `- ${x}`),
      ""
    ]),
    ...r.limitations.map((x) => `- ${safe(x[lang])}`)
  ].join("\n\n");
}
export function reportCsv(r: Report, lang: Language): string {
  return (
    "\ufeff" +
    [
      lang === "ar"
        ? [
            "القاعدة",
            "الحالة",
            "أولوية المعالجة",
            "العنوان",
            "الدليل",
            "المعالجة"
          ]
        : ["Rule", "State", "Priority", "Title", "Evidence", "Remediation"],
      ...r.findings.map((f) => [
        f.ruleId,
        stateNames[lang][f.state],
        priorityNames[lang][f.priority],
        f.title[lang],
        f.evidence,
        f.remediation[lang]
      ])
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}
export function reportHtml(r: Report, lang: Language): string {
  const e = escapeHtml;
  return `<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; base-uri 'none'; form-action 'none'"><title>${e(r.title[lang])}</title><style>body{font-family:Arial,Tahoma,sans-serif;max-width:960px;margin:40px auto;padding:24px;color:#17243b;line-height:1.8}h1{border-bottom:3px solid #17a98b;padding-bottom:16px}h2{font-size:19px}table{width:100%;border-collapse:collapse;overflow-wrap:anywhere}td,th{border:1px solid #d8dfe6;padding:10px;text-align:start}thead{display:table-header-group}article{border:1px solid #d8dfe6;border-radius:12px;padding:18px;margin:18px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;direction:ltr;text-align:left;background:#f3f5f7;padding:12px}small{color:#526175}.tag{font-size:12px}a{color:#146da8}p{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{margin:0;padding:0;font-size:11pt}article{break-inside:auto;box-decoration-break:clone}pre{break-inside:avoid}p{orphans:3;widows:3}h2,h3,h4{break-after:avoid}tr{break-inside:avoid}h2{break-after:avoid}a{color:inherit}.export-footer{display:none}}</style></head><body><small>CYBERLAB · ${e(r.reportId)}</small><h1>${e(r.title[lang])}</h1><p dir="ltr">${e(r.createdAt)} · ${e(r.engineVersion)} · ${e(reportStates[lang][r.status])}</p><p dir="ltr">${e(r.target)}</p><p>${e(r.author)}</p><p>${e(r.notes)}</p><table><thead><tr><th>${lang === "ar" ? "المشاهدة" : "Observation"}</th><th>${lang === "ar" ? "القيمة" : "Value"}</th></tr></thead><tbody>${r.observations.map((x) => `<tr><td>${e(x.label[lang])}</td><td><bdi dir="auto">${e(x.value ?? "—")}</bdi></td></tr>`).join("")}</tbody></table>${r.findings
    .map(
      (f) =>
        `<article><span class="tag">${e(stateNames[lang][f.state])} · ${e(priorityNames[lang][f.priority])} · ${e(f.ruleId)}</span><h2>${e(f.title[lang])}</h2><p>${e(f.explanation[lang])}</p><pre>${e(f.evidence)}</pre><p>${e(f.remediation[lang])}</p>${f.snippets.map((s) => `<h3>${e(s.platform)}</h3><pre>${e(s.code)}</pre>`).join("")}${f.references
          .filter((x) => /^https?:\/\//.test(x))
          .map((x) => `<p><a href="${e(x)}" rel="noreferrer">${e(x)}</a></p>`)
          .join("")}</article>`
    )
    .join(
      ""
    )}<h2>${lang === "ar" ? "حدود التقرير" : "Limitations"}</h2>${r.limitations.map((x) => `<p>${e(x[lang])}</p>`).join("")}<small class="export-footer">CyberLab · Local export</small></body></html>`;
}
