import {
  bi,
  finding,
  makeReport,
  observation,
  toolNames,
  type Report
} from "./report";
export interface LogEvent {
  time: number;
  ip: string;
  path: string;
  status: number;
  event: string;
}
export interface LogMapping {
  time: string;
  ip: string;
  path: string;
  status: string;
  event: string;
}
export const defaultMapping: LogMapping = {
  time: "timestamp",
  ip: "ip",
  path: "path",
  status: "status",
  event: "event"
};
export interface LogFilters {
  from?: string;
  to?: string;
  ip?: string;
  path?: string;
  status?: string;
}
export interface LogSummary {
  total: number;
  invalid: number;
  examples: string[];
  timeline: { time: number; count: number; errors: number }[];
  topIps: [string, number][];
  topPaths: [string, number][];
  report: Report;
}
function field(object: unknown, key: string): unknown {
  let value = object;
  for (const part of key.split(".")) {
    if (
      !part ||
      ["__proto__", "constructor", "prototype"].includes(part) ||
      !value ||
      typeof value !== "object" ||
      !Object.hasOwn(value, part)
    )
      return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
function localTimestamp(value: string, timeZone: string): number {
  const matches = value.match(
    /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)(?::(\d\d)(?:\.(\d+))?)?$/
  );
  if (!matches) return NaN;
  const values = matches.slice(1).map(Number);
  const milliseconds = Math.floor(Number("0." + (matches[7] || "0")) * 1000);
  const target = Date.UTC(
    values[0],
    values[1] - 1,
    values[2],
    values[3],
    values[4],
    values[5] || 0
  );
  let result = target;
  const valid = new Date(target);
  if (
    valid.getUTCFullYear() !== values[0] ||
    valid.getUTCMonth() !== values[1] - 1 ||
    valid.getUTCDate() !== values[2] ||
    values[3] > 23 ||
    values[4] > 59 ||
    (values[5] || 0) > 59
  )
    return NaN;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      formatter.formatToParts(result).map((x) => [x.type, x.value])
    );
    const rendered = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second
    );
    result += target - rendered;
    if (target === rendered) break;
  }
  return result + milliseconds;
}
export function parseLogLine(
  line: string,
  format: "combined" | "jsonl",
  mapping = defaultMapping,
  timeZone = "UTC"
): LogEvent {
  if (line.length > 65536) throw new Error("Line exceeds 64 KiB");
  let event: LogEvent;
  if (format === "combined") {
    const match = line.match(
      /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(?:\S+)\s+(.*?)\s+HTTP\/[\d.]+"\s+(\d{3})\s+/
    );
    if (!match) throw new Error("Invalid Combined Log");
    const date = match[2].replace(/^(\d{2})\/(\w{3})\/(\d{4}):/, "$1 $2 $3 ");
    event = {
      ip: match[1],
      time: Date.parse(date),
      path: match[3],
      status: +match[4],
      event: "http"
    };
  } else {
    const json: unknown = JSON.parse(line),
      time = field(json, mapping.time);
    const raw = String(time ?? "");
    const timestamp =
      typeof time === "number"
        ? time * (time < 1e12 ? 1000 : 1)
        : /[zZ]$|[+-]\d\d:?\d\d$/.test(raw)
          ? Date.parse(raw)
          : localTimestamp(raw, timeZone);
    event = {
      time: timestamp,
      ip: String(field(json, mapping.ip) ?? "—"),
      path: String(field(json, mapping.path) ?? "/"),
      status: Number(field(json, mapping.status) ?? 0),
      event: String(field(json, mapping.event) ?? "http")
    };
  }
  if (
    !Number.isFinite(event.time) ||
    !Number.isInteger(event.status) ||
    event.status < 0 ||
    event.status > 599 ||
    event.ip.length > 128
  )
    throw new Error("Invalid timestamp, IP field, or status");
  event.path = event.path.split("?")[0].split("#")[0].slice(0, 1024);
  event.event = event.event.slice(0, 200);
  return event;
}
export function filterLogs(
  events: LogEvent[],
  filters: LogFilters
): LogEvent[] {
  const from = filters.from ? Date.parse(filters.from) : NaN,
    to = filters.to ? Date.parse(filters.to) : NaN;
  return events.filter(
    (x) =>
      (!Number.isFinite(from) || x.time >= from) &&
      (!Number.isFinite(to) || x.time <= to) &&
      (!filters.ip || x.ip.includes(filters.ip)) &&
      (!filters.path ||
        x.path.toLowerCase().includes(filters.path.toLowerCase())) &&
      (!filters.status || String(x.status).startsWith(filters.status))
  );
}
export function summarizeLogs(
  events: LogEvent[],
  invalid = 0,
  examples: string[] = [],
  target = "local log",
  source: Report["source"] = "local"
): LogSummary {
  const report = makeReport("logs", toolNames.logs, target, source);
  const ips = new Map<string, number>(),
    paths = new Map<string, number>(),
    minutes = new Map<number, { count: number; errors: number }>(),
    bursts = new Map<string, number>(),
    denials = new Map<string, number>(),
    five = new Map<number, { total: number; errors: number }>();
  for (const e of events) {
    ips.set(e.ip, (ips.get(e.ip) ?? 0) + 1);
    paths.set(e.path, (paths.get(e.path) ?? 0) + 1);
    const minute = Math.floor(e.time / 60000) * 60000;
    const bin = minutes.get(minute) ?? { count: 0, errors: 0 };
    bin.count++;
    if (e.status >= 400) bin.errors++;
    minutes.set(minute, bin);
    const burstKey = e.ip + "|" + minute;
    bursts.set(burstKey, (bursts.get(burstKey) ?? 0) + 1);
    const span = Math.floor(e.time / 300000) * 300000,
      period = five.get(span) ?? { total: 0, errors: 0 };
    period.total++;
    if (e.status >= 500) period.errors++;
    five.set(span, period);
    if (e.status === 401 || e.status === 403 || e.event === "login_failed") {
      const key = e.ip + "|" + span;
      denials.set(key, (denials.get(key) ?? 0) + 1);
    }
  }
  const top = (map: Map<string, number>) =>
    [...map].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const timeline = [...minutes]
    .sort((a, b) => a[0] - b[0])
    .map(([time, v]) => ({ time, ...v }));
  let chart = timeline;
  if (timeline.length > 120) {
    const first = timeline[0].time,
      last = timeline[timeline.length - 1].time,
      width = Math.ceil((last - first + 60000) / 120 / 60000) * 60000;
    const bins = new Map<number, { count: number; errors: number }>();
    for (const item of timeline) {
      const time = first + Math.floor((item.time - first) / width) * width;
      const bin = bins.get(time) ?? { count: 0, errors: 0 };
      bin.count += item.count;
      bin.errors += item.errors;
      bins.set(time, bin);
    }
    chart = [...bins].map(([time, value]) => ({ time, ...value }));
  }
  report.observations.push(
    observation(
      "count",
      bi("الأحداث المقروءة", "Parsed events"),
      events.length
    ),
    observation("invalid", bi("الأسطر غير الصالحة", "Invalid lines"), invalid),
    observation(
      "start",
      bi("أول حدث", "First event"),
      timeline.length ? new Date(timeline[0].time).toISOString() : null
    ),
    observation(
      "end",
      bi("آخر فترة", "Last interval"),
      timeline.length
        ? new Date(timeline[timeline.length - 1].time).toISOString()
        : null
    )
  );
  const check = (
    id: string,
    count: number,
    title: [string, string],
    why: [string, string]
  ) =>
    report.findings.push(
      finding(
        id,
        count ? "warn" : "pass",
        bi(...title),
        String(count),
        bi(...why),
        bi(
          "راجع التوقيت والمسارات وسياق التشغيل، وقارن بمستوى الاستخدام المعتاد.",
          "Review timing, paths, and operational context against normal usage."
        ),
        count ? "medium" : "info"
      )
    );
  check(
    "logs.burst",
    [...bursts.values()].filter((x) => x >= 30).length,
    ["ارتفاع كثافة الطلبات", "Request bursts"],
    [
      "30 طلبًا أو أكثر من عنوان واحد خلال دقيقة ثابتة؛ قد يكون نشاطًا مشروعًا.",
      "At least 30 requests from one IP in a fixed minute; legitimate traffic may match."
    ]
  );
  check(
    "logs.denials",
    [...denials.values()].filter((x) => x >= 10).length,
    ["تكرار أحداث رفض الوصول", "Repeated access denials"],
    [
      "10 أحداث 401/403 أو login_failed خلال خمس دقائق ثابتة؛ لا تثبت محاولة اختراق.",
      "At least 10 HTTP 401/403 or login_failed events per IP in five fixed minutes; this does not prove an intrusion."
    ]
  );
  check(
    "logs.errors",
    [...five.values()].filter((x) => x.total >= 20 && x.errors / x.total >= 0.2)
      .length,
    ["ارتفاع أخطاء الخادم", "Elevated server errors"],
    [
      "20 حدثًا أو أكثر، منها 20% أخطاء 5xx على الأقل خلال خمس دقائق ثابتة.",
      "At least 20 events, with at least 20% HTTP 5xx responses in five fixed minutes."
    ]
  );
  top(ips).forEach(([value, count], i) =>
    report.observations.push(
      observation(
        "ip." + i,
        bi("عنوان متكرر", "Frequent IP"),
        `${value}: ${count}`
      )
    )
  );
  top(paths).forEach(([value, count], i) =>
    report.observations.push(
      observation(
        "path." + i,
        bi("مسار متكرر", "Frequent path"),
        `${value}: ${count}`
      )
    )
  );
  report.limitations.push(
    bi(
      "المؤشرات تعتمد على عتبات ثابتة وليست إثباتًا لهجوم. لا تُضمّن السجلات الأصلية في التقرير.",
      "Indicators use fixed thresholds and are not proof of an attack. Original logs are not included in the report."
    ),
    bi(
      "تُحذف معاملات المسارات أثناء القراءة. الأوقات دون إزاحة تعتمد المنطقة المختارة؛ قد تكون أوقات انتقال التوقيت الصيفي ملتبسة.",
      "Path query parameters are removed during parsing. Offset-free times use the selected zone; daylight-saving transitions may be ambiguous."
    )
  );
  return {
    total: events.length,
    invalid,
    examples,
    timeline: chart,
    topIps: top(ips),
    topPaths: top(paths),
    report
  };
}
export function sampleLogs(): string {
  return Array.from({ length: 80 }, (_, i) =>
    JSON.stringify({
      timestamp: new Date(Date.UTC(2026, 9, 30, 9, 0, i)).toISOString(),
      ip: i % 5 ? "203.0.113.42" : "198.51.100.7",
      path: i % 3 ? "/api/session" : "/dashboard",
      status: i < 22 ? 503 : i < 40 ? 403 : 200,
      event: i >= 22 && i < 40 ? "login_failed" : "http"
    })
  ).join("\n");
}
