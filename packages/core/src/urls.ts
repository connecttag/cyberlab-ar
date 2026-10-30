import { parse } from "tldts";
import { toUnicode } from "punycode/";
import {
  bi,
  finding,
  makeReport,
  observation,
  toolNames,
  type Report
} from "./report";
import { redactUrl } from "./redact";
export function analyzeUrl(
  input: string,
  source: Report["source"] = "local"
): Report {
  if (input.length > 4096) throw new Error("INVALID_URL");
  let url: URL;
  try {
    url = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : "https://" + input
    );
  } catch {
    throw new Error("INVALID_URL");
  }
  const report = makeReport("url", toolNames.url, redactUrl(url.href), source);
  const domain = parse(url.hostname, { allowPrivateDomains: true });
  const unicode = toUnicode(url.hostname);
  for (const [key, ar, en, value] of [
    ["scheme", "البروتوكول", "Protocol", url.protocol],
    ["host", "المضيف ASCII", "ASCII host", url.hostname],
    ["unicode", "المضيف Unicode", "Unicode host", unicode],
    ["domain", "النطاق المسجل", "Registrable domain", domain.domain],
    ["subdomain", "النطاق الفرعي", "Subdomain", domain.subdomain],
    ["suffix", "اللاحقة العامة", "Public suffix", domain.publicSuffix],
    [
      "port",
      "المنفذ",
      "Port",
      url.port || ({ "https:": "443", "http:": "80" }[url.protocol] ?? "—")
    ],
    ["path", "المسار", "Path", url.pathname],
    ["fragment", "وجود جزء محلي #", "Fragment present", url.hash ? "✓" : "—"]
  ] as const)
    report.observations.push(observation(key, bi(ar, en), value ?? null));
  for (const [index, [key, value]] of [
    ...new URL(report.target).searchParams.entries()
  ]
    .slice(0, 60)
    .entries())
    report.observations.push(
      observation(
        "query." + index,
        bi("معامل: " + key, "Parameter: " + key),
        value
      )
    );
  const add = (
    id: string,
    warning: boolean,
    title: [string, string],
    why: [string, string],
    evidence: string
  ) =>
    report.findings.push(
      finding(
        id,
        warning ? "warn" : "pass",
        bi(...title),
        evidence,
        bi(...why),
        bi(
          "راجع المؤشر قبل مشاركة الرابط أو فتحه.",
          "Review the indicator before sharing or opening the link."
        ),
        warning ? "low" : "info"
      )
    );
  add(
    "url.scheme",
    !["https:", "http:"].includes(url.protocol),
    ["مخطط الرابط", "URL scheme"],
    [
      "المخططات خارج HTTP وHTTPS تحتاج معالجة مختلفة ولا تُفتح من هذه الأداة.",
      "Schemes other than HTTP/HTTPS require different handling and cannot be opened from this tool."
    ],
    url.protocol
  );
  add(
    "url.transport",
    url.protocol === "http:",
    ["تشفير الرابط", "URL transport"],
    [
      "HTTP لا يوفر تشفير النقل.",
      "HTTP does not provide transport encryption."
    ],
    url.protocol
  );
  add(
    "url.credentials",
    !!url.username || !!url.password,
    ["معلومات دخول داخل الرابط", "Embedded credentials"],
    [
      "قد تضلل معلومات الدخول القارئ وتكشف أسرارًا عند مشاركة الرابط؛ أُخفيت القيم.",
      "Embedded credentials can mislead readers and expose secrets when shared; values are hidden."
    ],
    url.username || url.password ? "[REDACTED]" : "—"
  );
  add(
    "url.port",
    !!url.port,
    ["منفذ مخصص", "Custom port"],
    [
      "المنفذ المخصص مؤشر سياقي وقد يكون مشروعًا.",
      "A custom port is contextual and may be legitimate."
    ],
    url.port || "—"
  );
  const mixed =
    /[a-z]/i.test(unicode) &&
    /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Arabic}]/u.test(
      unicode.replace(/\.[a-z]+$/i, "")
    );
  add(
    "url.scripts",
    mixed,
    ["خلط أبجديات النطاق", "Mixed-script hostname"],
    [
      "اختلاط الأبجديات قد يسبب التباسًا بصريًا؛ ليس دليلًا على الضرر.",
      "Mixed scripts may cause visual confusion; this is not proof of maliciousness."
    ],
    unicode
  );
  add(
    "url.encoding",
    /%25[0-9a-f]{2}/i.test(input),
    ["ترميز متداخل", "Nested encoding"],
    [
      "قد يخفي الترميز المتداخل المعنى الظاهر للمسار أو المعاملات.",
      "Nested encoding may obscure the visible meaning of paths or parameters."
    ],
    redactUrl(url.href)
  );
  report.limitations.push(
    bi(
      "تحليل بنية الرابط لا يتحقق من سمعة الموقع أو محتواه أو هويته. لا تُفتح الوجهة أثناء التحليل.",
      "Structural analysis does not verify site reputation, content, or identity. The destination is not opened during analysis."
    )
  );
  return report;
}
