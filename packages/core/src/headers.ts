import {
  bi,
  finding,
  makeReport,
  observation,
  toolNames,
  type Report,
  type Finding,
  type CheckState
} from "./report";
import { redactText, redactUrl } from "./redact";
export type HeaderPair = [string, string];
const reference =
  "https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html";
export interface RedirectHop {
  url: string;
  status: number;
  location?: string;
}
export interface HeaderInput {
  url: string;
  headers: HeaderPair[];
  status?: number;
  elapsed?: number;
  redirects?: RedirectHop[];
  dns?: { name: string; type: number; data: string; TTL: number }[];
  source?: Report["source"];
}
export const SAMPLE_HEADERS = `HTTP/2 200\nContent-Type: text/html; charset=utf-8\nContent-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'\nStrict-Transport-Security: max-age=0\nX-Content-Type-Options: nosniff\nReferrer-Policy: unsafe-url\nSet-Cookie: demo_session=demo-value; Path=/; HttpOnly; SameSite=None\nSet-Cookie: preferences=demo; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Path=/; Secure; SameSite=Lax\nServer: demo-server`;
export function parseHeaders(text: string): {
  headers: HeaderPair[];
  status?: number;
  invalid: number;
} {
  if (text.length > 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  const headers: HeaderPair[] = [];
  let status: number | undefined;
  let invalid = 0;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) continue;
    const statusLine = line.match(/^HTTP\/[\d.]+\s+(\d{3})/i);
    if (statusLine) {
      status = Number(statusLine[1]);
      continue;
    }
    const pair = line.match(/^([!#$%&'*+.^_`|~\da-z-]+):\s*(.*)$/i);
    if (!pair) {
      invalid++;
      continue;
    }
    headers.push([pair[1].toLowerCase(), pair[2].slice(0, 16000)]);
  }
  return { headers, status, invalid };
}
export function parseHar(text: string): HeaderInput[] {
  if (text.length > 8 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  const har = JSON.parse(text);
  if (!Array.isArray(har?.log?.entries)) throw new Error("INVALID_HAR");
  return har.log.entries
    .slice(0, 100)
    .filter(
      (entry: unknown) =>
        typeof (entry as { request?: { url?: unknown } })?.request?.url ===
        "string"
    )
    .map(
      (entry: {
        request: { url: string };
        response?: {
          status?: number;
          headers?: { name: string; value: string }[];
        };
      }) => ({
        url: entry.request.url,
        source: "import",
        status: entry.response?.status,
        headers: (entry.response?.headers ?? [])
          .filter(
            (h) => typeof h.name === "string" && typeof h.value === "string"
          )
          .slice(0, 200)
          .map((h) => [h.name, h.value.slice(0, 16000)])
      })
    );
}
const configurations: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN"
};
function snippets(header: string): Finding["snippets"] {
  const value = configurations[header];
  if (!value) return [];
  const effective =
    header === "Content-Security-Policy"
      ? "Content-Security-Policy-Report-Only"
      : header;
  return [
    { platform: "Nginx", code: `add_header ${effective} "${value}" always;` },
    { platform: "Apache", code: `Header always set ${effective} "${value}"` },
    {
      platform: "Cloudflare Workers",
      code: `const headers = new Headers(response.headers);\nheaders.set(${JSON.stringify(effective)}, ${JSON.stringify(value)});\nreturn new Response(response.body, { status: response.status, headers });`
    }
  ];
}
export function analyzeHeaders(input: HeaderInput): Report {
  const report = makeReport(
    "web",
    toolNames.web,
    redactUrl(input.url),
    input.source ?? "import"
  );
  const grouped = new Map<string, string[]>();
  for (const [name, value] of input.headers) {
    const key = name.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  const get = (key: string) => (grouped.get(key) ?? []).join("\n");
  const html = /\b(text\/html|application\/xhtml\+xml)\b/i.test(
    get("content-type")
  );
  const knownContent = !!get("content-type");
  const https = input.url.startsWith("https://");
  const add = (
    rule: string,
    state: CheckState,
    ar: string,
    en: string,
    evidence: string,
    explanation: [string, string],
    remediation: [string, string],
    priority: Finding["priority"] = "info",
    header?: string
  ) =>
    report.findings.push(
      finding(
        rule,
        state,
        bi(ar, en),
        redactText(evidence).slice(0, 16000),
        bi(...explanation),
        bi(...remediation),
        priority,
        [reference],
        header ? snippets(header) : []
      )
    );
  report.observations.push(
    observation("url", bi("الرابط المرصود", "Observed URL"), report.target),
    observation(
      "status",
      bi("استجابة HTTP", "HTTP status"),
      input.status ?? null,
      input.status ? "direct" : "unavailable"
    ),
    observation(
      "content-type",
      bi("نوع المحتوى", "Content type"),
      get("content-type") || null,
      knownContent ? "direct" : "unavailable"
    )
  );
  if (input.elapsed !== undefined)
    report.observations.push(
      observation(
        "elapsed",
        bi("زمن الحصول على الترويسات (ms)", "Time to headers (ms)"),
        Math.round(input.elapsed)
      )
    );
  const csp = get("content-security-policy"),
    reportOnly = get("content-security-policy-report-only");
  const cspState: CheckState =
    knownContent && !html
      ? "na"
      : !knownContent
        ? "untested"
        : !csp
          ? "fail"
          : "pass";
  add(
    "web.csp.present",
    cspState,
    "سياسة أمان المحتوى",
    "Content Security Policy",
    csp || reportOnly || "—",
    csp
      ? [
          "لوحظت سياسة مطبقة. يتم تحليل محتواها بصورة مستقلة.",
          "An enforced policy was observed. Its directives are evaluated separately."
        ]
      : reportOnly
        ? [
            "السياسة Report-Only تجمع الملاحظات ولا تفرض الحماية.",
            "A Report-Only policy observes violations without enforcing protection."
          ]
        : [
            "لم تُلاحظ سياسة مطبقة لاستجابة HTML.",
            "No enforced policy was observed for an HTML response."
          ],
    [
      "ابدأ بسياسة Report-Only ملائمة للتطبيق ثم راجع التقارير قبل فرضها.",
      "Start with an application-specific Report-Only policy, review reports, then enforce it."
    ],
    cspState === "fail" ? "medium" : "info",
    "Content-Security-Policy"
  );
  if (csp) {
    const policies = grouped.get("content-security-policy")!;
    const risky = policies.filter((policy) => {
      const script =
        policy.match(/(?:^|;)\s*script-src\s+([^;]+)/i)?.[1] ??
        policy.match(/(?:^|;)\s*default-src\s+([^;]+)/i)?.[1] ??
        "";
      return (
        /'unsafe-eval'|(?:^|\s)\*(?:\s|$)/.test(script) ||
        (/'unsafe-inline'/.test(script) &&
          !/'(?:nonce-|sha(?:256|384|512)-)/.test(script))
      );
    });
    add(
      "web.csp.directives",
      risky.length ? "warn" : "pass",
      "توجيهات السياسة",
      "Policy directives",
      csp,
      [
        "يُفحص السماح الواسع وunsafe-eval وunsafe-inline دون nonce أو hash؛ السياسات المتعددة تتقاطع وقد تحد بعضها بعضًا.",
        "Broad sources, unsafe-eval, and unsafe-inline without nonce/hash are checked; multiple policies intersect and may restrict each other."
      ],
      [
        "راجع المصادر المطلوبة وأضف nonce أو hash للبرامج المناسبة واختبر سلوك التطبيق.",
        "Review required sources, use nonces or hashes where appropriate, and test application behavior."
      ],
      risky.length ? "medium" : "info",
      "Content-Security-Policy"
    );
  }
  const hsts = get("strict-transport-security"),
    age = hsts.match(/(?:^|;)\s*max-age\s*=\s*"?(\d+)"?(?=\s*(?:;|$))/i);
  add(
    "web.hsts",
    !https ? "na" : !hsts || !age || Number(age[1]) === 0 ? "fail" : "pass",
    "فرض HTTPS عبر HSTS",
    "HTTPS enforcement with HSTS",
    hsts || "—",
    [
      "تُقيّم هذه الترويسة عند استقبالها عبر HTTPS؛ max-age=0 يعطل السياسة.",
      "This header is evaluated over HTTPS; max-age=0 disables the policy."
    ],
    [
      "فعّل max-age مناسبًا بعد التأكد من جاهزية HTTPS. راجع النطاقات الفرعية قبل توسيع السياسة.",
      "Enable a suitable max-age after HTTPS readiness. Review subdomains before broadening the policy."
    ],
    https && (!age || Number(age[1]) === 0) ? "medium" : "info",
    "Strict-Transport-Security"
  );
  const ancestors =
    !!csp &&
    grouped
      .get("content-security-policy")!
      .some((p) => /(?:^|;)\s*frame-ancestors\s+/i.test(p));
  const xfo = get("x-frame-options");
  add(
    "web.framing",
    knownContent && !html
      ? "na"
      : !knownContent
        ? "untested"
        : ancestors || /^(DENY|SAMEORIGIN)$/i.test(xfo)
          ? "pass"
          : "warn",
    "حماية تضمين الصفحة",
    "Framing protection",
    ancestors ? csp : xfo || "—",
    [
      "توجيه frame-ancestors المطبق يتقدم على X-Frame-Options في المتصفحات الحديثة.",
      "Enforced frame-ancestors takes precedence over X-Frame-Options in modern browsers."
    ],
    [
      "اختر الجهات المسموح لها بتضمين الصفحة وفق احتياجات التطبيق.",
      "Choose which origins may embed the page based on application requirements."
    ],
    !ancestors && !xfo && html ? "medium" : "info",
    "X-Frame-Options"
  );
  const nosniff = get("x-content-type-options");
  add(
    "web.nosniff",
    nosniff.toLowerCase() === "nosniff" ? "pass" : "warn",
    "منع تخمين نوع المحتوى",
    "MIME sniffing protection",
    nosniff || "—",
    [
      "nosniff يحد من تفسير المحتوى بنوع مختلف عن المعلن.",
      "nosniff limits content interpretation that differs from the declared MIME type."
    ],
    [
      "أرسل نوع محتوى صحيحًا مع X-Content-Type-Options: nosniff.",
      "Send a correct content type with X-Content-Type-Options: nosniff."
    ],
    nosniff === "nosniff" ? "info" : "low",
    "X-Content-Type-Options"
  );
  const referrer = get("referrer-policy");
  add(
    "web.referrer",
    /unsafe-url/i.test(referrer) ? "warn" : referrer ? "pass" : "warn",
    "سياسة الإحالة",
    "Referrer policy",
    referrer || "—",
    [
      "غياب السياسة لا يثبت تسريبًا؛ تطبق المتصفحات الحديثة سياسة افتراضية. unsafe-url قد يكشف المسار والمعاملات.",
      "Absence does not prove a leak; modern browsers have a default policy. unsafe-url can expose paths and query parameters."
    ],
    [
      "اختر strict-origin-when-cross-origin أو سياسة أشد ملائمة للتطبيق.",
      "Choose strict-origin-when-cross-origin or a stricter policy appropriate to the app."
    ],
    /unsafe-url/i.test(referrer) ? "low" : "info",
    "Referrer-Policy"
  );
  for (const name of [
    "permissions-policy",
    "cross-origin-opener-policy",
    "cross-origin-embedder-policy",
    "cross-origin-resource-policy"
  ])
    add(
      "web.context." + name,
      get(name) ? "pass" : "na",
      name,
      name,
      get(name) || "—",
      [
        "هذه سياسة سياقية؛ غيابها وحده ليس ثغرة. التفعيل قد يؤثر في التكامل مع مصادر أخرى.",
        "This policy is contextual; its absence alone is not a vulnerability. Enabling it can affect cross-origin integrations."
      ],
      [
        "حدد حاجتك للعزل والميزات ثم اختبر الموارد والنوافذ المرتبطة.",
        "Determine isolation and feature needs, then test dependent resources and windows."
      ]
    );
  const cookies = grouped.get("set-cookie") ?? [];
  if (!cookies.length)
    add(
      "web.cookies.observed",
      "untested",
      "خصائص Cookies",
      "Cookie attributes",
      "—",
      [
        "لم ترسل هذه الاستجابة Cookies؛ لا يشمل ذلك جلسات تسجيل الدخول أو JavaScript.",
        "This response did not set cookies; login sessions and JavaScript-set cookies are not covered."
      ],
      [
        "افحص استجابات الجلسات محليًا باستخدام HAR منقح.",
        "Inspect session responses locally using a redacted HAR."
      ]
    );
  cookies.slice(0, 30).forEach((raw, index) => {
    const [pair, ...attributes] = raw.split(";");
    const cookieName = pair.split("=")[0].trim().slice(0, 120);
    const attrs = attributes.map((x) => x.trim());
    const secure = attrs.some((x) => /^secure$/i.test(x)),
      httpOnly = attrs.some((x) => /^httponly$/i.test(x));
    const sameSite = attrs
      .find((x) => /^samesite=/i.test(x))
      ?.split("=")[1]
      ?.toLowerCase();
    const invalidNone = sameSite === "none" && !secure;
    const invalidPrefix =
      (cookieName.startsWith("__Host-") &&
        (!secure ||
          attrs.some((x) => /^domain=/i.test(x)) ||
          !attrs.some((x) => /^path=\/$/i.test(x)))) ||
      (cookieName.startsWith("__Secure-") && !secure);
    const state: CheckState =
      invalidNone || invalidPrefix
        ? "fail"
        : (https && !secure) || !sameSite
          ? "warn"
          : "pass";
    add(
      "web.cookie." + index,
      state,
      "خصائص Cookie: " + cookieName,
      "Cookie attributes: " + cookieName,
      `${cookieName}=[REDACTED]; ${attrs.join("; ")}`,
      [
        `Secure: ${secure}؛ HttpOnly: ${httpOnly}؛ SameSite: ${sameSite ?? "—"}. HttpOnly يعتمد على دور Cookie.`,
        `Secure: ${secure}; HttpOnly: ${httpOnly}; SameSite: ${sameSite ?? "—"}. HttpOnly requirements depend on the cookie's role.`
      ],
      [
        "اضبط Secure عبر HTTPS وSameSite الملائم، وHttpOnly للجلسات التي لا يحتاج JavaScript لقراءتها.",
        "Use Secure over HTTPS, appropriate SameSite, and HttpOnly for sessions that JavaScript does not need to read."
      ],
      state === "fail" ? "medium" : state === "warn" ? "low" : "info"
    );
  });
  if (get("access-control-allow-origin"))
    add(
      "web.cors",
      "warn",
      "سياسة مشاركة المصادر",
      "Cross-origin resource policy",
      get("access-control-allow-origin"),
      [
        "الترويسة وحدها لا تثبت وصولًا غير مصرح؛ لا ينفذ هذا الفحص طلبات Origins مختلفة.",
        "A header alone does not prove unauthorized access; this audit does not probe different Origins."
      ],
      [
        "راجع حساسية الاستجابة والجهات المسموح لها وسلوك المتصفح الفعلي.",
        "Review response sensitivity, allowed origins, and actual browser behavior."
      ]
    );
  for (const [index, hop] of (input.redirects ?? []).entries()) {
    report.observations.push(
      observation(
        "redirect." + index,
        bi("خطوة تحويل " + (index + 1), "Redirect hop " + (index + 1)),
        `${hop.status} ${redactUrl(hop.url)}${hop.location ? " → " + redactUrl(hop.location) : ""}`
      )
    );
    if (
      hop.location &&
      hop.url.startsWith("https:") &&
      hop.location.startsWith("http:")
    )
      add(
        "web.redirect.downgrade." + index,
        "fail",
        "تحويل إلى HTTP",
        "HTTPS downgrade",
        `${redactUrl(hop.url)} → ${redactUrl(hop.location)}`,
        [
          "تتراجع سلسلة الاتصال من HTTPS إلى HTTP.",
          "The redirect chain downgrades from HTTPS to HTTP."
        ],
        [
          "حافظ على HTTPS في وجهات التحويل.",
          "Keep redirect destinations on HTTPS."
        ],
        "high"
      );
    if (
      hop.location &&
      new URL(hop.location).hostname !== new URL(hop.url).hostname
    )
      add(
        "web.redirect.domain." + index,
        "warn",
        "تغير النطاق أثناء التحويل",
        "Redirect host change",
        redactUrl(hop.location),
        [
          "تغير المضيف؛ قد يكون ذلك جزءًا طبيعيًا من بنية الموقع.",
          "The host changed; this can be normal application behavior."
        ],
        [
          "تحقق من أن الوجهة المقصودة متوقعة.",
          "Verify that the destination is expected."
        ]
      );
  }
  for (const [index, dns] of (input.dns ?? []).slice(0, 60).entries())
    report.observations.push(
      observation(
        "dns." + index,
        bi("سجل DNS", "DNS record"),
        `${({ 1: "A", 5: "CNAME", 28: "AAAA", 257: "CAA" } as Record<number, string>)[dns.type]} ${dns.name}: ${dns.data} (TTL ${dns.TTL})`
      )
    );
  report.limitations.push(
    bi(
      "النتيجة تخص الاستجابة والوقت المرصودين؛ لا تثبت أمان التطبيق بالكامل.",
      "Results cover the observed response and time, not overall application security."
    ),
    bi(
      "لا يشمل الفحص محتوى الصفحة أو تنفيذ JavaScript أو تفاصيل شهادة TLS أو جلسات دخول المستخدم.",
      "Page content, JavaScript execution, TLS certificate details, and authenticated sessions are outside this audit."
    )
  );
  if (!knownContent) report.status = "partial";
  return report;
}
