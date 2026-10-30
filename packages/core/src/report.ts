import { z } from "zod";
export type Language = "ar" | "en";
export const localized = z
  .object({ ar: z.string().max(12000), en: z.string().max(12000) })
  .strict();
export type Localized = z.infer<typeof localized>;
export const bi = (ar: string, en: string): Localized => ({ ar, en });
export const ENGINE_VERSION = "1.0.0";
export const stateSchema = z.enum(["pass", "warn", "fail", "na", "untested"]);
export type CheckState = z.infer<typeof stateSchema>;
export const findingSchema = z
  .object({
    ruleId: z.string().max(100),
    state: stateSchema,
    priority: z.enum(["info", "low", "medium", "high"]),
    confidence: z.enum(["direct", "inferred"]),
    title: localized,
    explanation: localized,
    remediation: localized,
    evidence: z.string().max(16000),
    references: z.array(z.url().max(2000)).max(10),
    snippets: z
      .array(
        z
          .object({ platform: z.string().max(80), code: z.string().max(6000) })
          .strict()
      )
      .max(5)
  })
  .strict();
export type Finding = z.infer<typeof findingSchema>;
export const observationSchema = z
  .object({
    key: z.string().max(160),
    label: localized,
    value: z.union([
      z.string().max(16000),
      z.number().finite(),
      z.boolean(),
      z.null()
    ]),
    kind: z.enum(["direct", "inferred", "unavailable"])
  })
  .strict();
export type Observation = z.infer<typeof observationSchema>;
export const reportSchema = z
  .object({
    schemaVersion: z.literal(1),
    reportId: z.uuid(),
    toolId: z.enum(["web", "url", "browser", "logs", "bundle"]),
    createdAt: z.iso.datetime(),
    engineVersion: z.string().max(100),
    status: z.enum(["complete", "partial", "failed"]),
    title: localized,
    source: z.enum(["live", "import", "local", "demo"]),
    target: z.string().max(4096),
    observations: z.array(observationSchema).max(500),
    findings: z.array(findingSchema).max(200),
    limitations: z.array(localized).max(40),
    author: z.string().max(200).default(""),
    notes: z.string().max(12000).default("")
  })
  .strict();
export type Report = z.infer<typeof reportSchema>;
export const scanInputSchema = z
  .object({
    url: z.string().trim().min(1).max(4096),
    turnstileToken: z.string().min(1).max(2048)
  })
  .strict();
export function makeReport(
  toolId: Report["toolId"],
  title: Localized,
  target = "",
  source: Report["source"] = "local"
): Report {
  return {
    schemaVersion: 1,
    reportId: crypto.randomUUID(),
    toolId,
    title,
    target,
    source,
    createdAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    status: "complete",
    observations: [],
    findings: [],
    limitations: [],
    author: "",
    notes: ""
  };
}
export function observation(
  key: string,
  label: Localized,
  value: Observation["value"],
  kind: Observation["kind"] = "direct"
): Observation {
  return { key, label, value, kind };
}
export function finding(
  ruleId: string,
  state: CheckState,
  title: Localized,
  evidence: string,
  explanation: Localized,
  remediation: Localized = bi(
    "راجع الإعداد في سياق التطبيق.",
    "Review this setting in the application context."
  ),
  priority: Finding["priority"] = "info",
  references: string[] = [],
  snippets: Finding["snippets"] = []
): Finding {
  return {
    ruleId,
    state,
    title,
    evidence,
    explanation,
    remediation,
    priority,
    confidence: "direct",
    references,
    snippets
  };
}
export function summarize(report: Report) {
  return Object.fromEntries(
    ["pass", "warn", "fail", "na", "untested"].map((state) => [
      state,
      report.findings.filter((x) => x.state === state).length
    ])
  ) as Record<CheckState, number>;
}
export function compareReports(before: Report, after: Report) {
  const compatible =
    before.toolId !== "bundle" &&
    before.toolId === after.toolId &&
    before.target === after.target;
  const rulesChanged = before.engineVersion !== after.engineVersion;
  const old = new Map(before.findings.map((x) => [x.ruleId, x]));
  const current = new Map(after.findings.map((x) => [x.ruleId, x]));
  return {
    compatible,
    rulesChanged,
    added: after.findings.filter((x) => !old.has(x.ruleId)),
    removed: before.findings.filter((x) => !current.has(x.ruleId)),
    resolved: after.findings.filter(
      (x) =>
        x.state === "pass" &&
        ["warn", "fail"].includes(old.get(x.ruleId)?.state ?? "")
    ),
    regressed: after.findings.filter(
      (x) =>
        ["warn", "fail"].includes(x.state) &&
        old.get(x.ruleId)?.state === "pass"
    ),
    changed: after.findings.filter(
      (x) =>
        old.has(x.ruleId) &&
        JSON.stringify(old.get(x.ruleId)) !== JSON.stringify(x)
    ),
    observations: after.observations.filter(
      (x) =>
        JSON.stringify(
          before.observations.find((p) => p.key === x.key)?.value
        ) !== JSON.stringify(x.value)
    )
  };
}
export const toolNames = {
  web: bi("فحص أمان الويب", "Web security audit"),
  url: bi("الروابط وQR", "Links & QR"),
  browser: bi("خصوصية المتصفح", "Browser privacy"),
  logs: bi("تحليل السجلات", "Log analysis"),
  bundle: bi("تقرير مجمّع", "Combined report")
};
