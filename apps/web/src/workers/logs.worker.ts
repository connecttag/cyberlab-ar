import { csvCell } from "@cyberlab/core/redact";
import {
  defaultMapping,
  parseLogLine,
  summarizeLogs,
  filterLogs,
  type LogEvent,
  type LogFilters,
  type LogMapping
} from "@cyberlab/core/logs";
let events: LogEvent[] = [];
let invalid = 0;
let examples: string[] = [];
let target = "";
let truncated = false;
self.onmessage = async ({
  data
}: {
  data: {
    type: string;
    file?: File;
    format?: "combined" | "jsonl";
    mapping?: LogMapping;
    timeZone?: string;
    filters?: LogFilters;
    page?: number;
  };
}) => {
  try {
    if (data.type === "parse" && data.file) {
      const file = data.file;
      if (file.size > 50 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
      events = [];
      invalid = 0;
      examples = [];
      target = file.name;
      truncated = false;
      const reader = file
        .stream()
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let rest = "",
        bytes = 0,
        lineNumber = 0;
      const line = (text: string) => {
        lineNumber++;
        if (!text.trim()) return;
        if (events.length >= 200000) {
          truncated = true;
          return;
        }
        try {
          events.push(
            parseLogLine(
              text.replace(/\r$/, ""),
              data.format ?? "combined",
              data.mapping ?? defaultMapping,
              data.timeZone ?? "UTC"
            )
          );
        } catch (error) {
          invalid++;
          if (examples.length < 5)
            examples.push(
              `Line ${lineNumber}: ${error instanceof SyntaxError ? "Invalid JSON record" : error instanceof Error ? error.message : "Invalid line"}`
            );
        }
      };
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += new TextEncoder().encode(chunk.value).length;
          const lines = (rest + chunk.value).split("\n");
          rest = lines.pop() ?? "";
          if (rest.length > 65536) throw new Error("LINE_TOO_LARGE");
          for (const entry of lines) line(entry);
          self.postMessage({
            type: "progress",
            progress: Math.min(99, Math.floor((bytes / file.size) * 100)),
            count: events.length
          });
          if (truncated) break;
        }
      } finally {
        await reader.cancel();
      }
      if (rest && !truncated) line(rest);
      const summary = summarizeLogs(events, invalid, examples, target);
      if (truncated)
        summary.report.limitations.push({
          ar: "توقف التحليل عند حد 200 ألف حدث؛ النتيجة جزئية.",
          en: "Analysis stopped at 200,000 events; results are partial."
        });
      if (truncated) summary.report.status = "partial";
      self.postMessage({ type: "summary", summary });
      self.postMessage({
        type: "page",
        events: events.slice(0, 50),
        count: events.length,
        page: 0
      });
    } else if (data.type === "page") {
      const rows = filterLogs(events, data.filters ?? {}),
        page = Math.max(0, data.page ?? 0);
      self.postMessage({
        type: "page",
        events: rows.slice(page * 50, page * 50 + 50),
        count: rows.length,
        page
      });
    } else if (data.type === "csv") {
      const rows = filterLogs(events, data.filters ?? {});
      const csv =
        "\ufeff" +
        [
          ["Time (UTC)", "IP", "Path (query removed)", "Status", "Event"],
          ...rows.map((e) => [
            new Date(e.time).toISOString(),
            e.ip,
            e.path,
            e.status,
            e.event
          ])
        ]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n");
      self.postMessage({ type: "csv", csv });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      code: error instanceof Error ? error.message : "INVALID_LOG"
    });
  }
};
