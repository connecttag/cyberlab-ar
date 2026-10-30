import { useEffect, useRef, useState } from "react";
import {
  FileUp,
  FlaskConical,
  ListFilter,
  Download,
  LoaderCircle
} from "lucide-react";
import {
  defaultMapping,
  sampleLogs,
  type LogEvent,
  type LogFilters,
  type LogMapping,
  type LogSummary
} from "@cyberlab/core/logs";
import { useLab } from "../context";
import { errorText } from "../messages";
import { download } from "../lib/download";
import ReportView from "../components/ReportView";
export default function LogsTool() {
  const { lang, t, text, addReport } = useLab();
  const [file, setFile] = useState<File>(),
    [format, setFormat] = useState<"jsonl" | "combined">("combined"),
    [zone, setZone] = useState("UTC"),
    [mapping, setMapping] = useState<LogMapping>(defaultMapping),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [summary, setSummary] = useState<LogSummary>(),
    [rows, setRows] = useState<LogEvent[]>([]),
    [count, setCount] = useState(0),
    [page, setPage] = useState(0),
    [filters, setFilters] = useState<LogFilters>({});
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const choose = async (value: File) => {
    if (value.size > 50 * 1024 * 1024) {
      setError(errorText("FILE_TOO_LARGE", lang));
      return;
    }
    setFile(value);
    setPreview(
      (await value.slice(0, 2048).text()).split("\n").slice(0, 3).join("\n")
    );
    if (value.name.endsWith(".jsonl") || value.name.endsWith(".ndjson"))
      setFormat("jsonl");
    setError("");
  };
  const run = (value = file, selectedFormat = format) => {
    if (!value) return;
    setBusy(true);
    setError("");
    setProgress(0);
    setSummary(undefined);
    setRows([]);
    setFilters({});
    setPage(0);
    worker.current?.terminate();
    worker.current = new Worker(
      new URL("../workers/logs.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.current.onmessage = ({ data }) => {
      if (data.type === "progress") setProgress(data.progress);
      if (data.type === "summary") {
        setBusy(false);
        setSummary(data.summary);
        addReport(data.summary.report);
      }
      if (data.type === "page") {
        setRows(data.events);
        setCount(data.count);
        setPage(data.page);
      }
      if (data.type === "error") {
        setBusy(false);
        setError(errorText(data.code, lang));
      }
      if (data.type === "csv")
        download("cyberlab-events.csv", data.csv, "text/csv;charset=utf-8");
    };
    worker.current.onerror = () => {
      setBusy(false);
      setError(errorText("INVALID_LOG", lang));
    };
    worker.current.postMessage({
      type: "parse",
      file: value,
      format: selectedFormat,
      mapping,
      timeZone: zone
    });
  };
  const updateFilter = (key: keyof LogFilters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    worker.current?.postMessage({ type: "page", filters: next, page: 0 });
  };
  const max = Math.max(
    1,
    ...(summary?.timeline ?? []).slice(0, 120).map((x) => x.count)
  );
  return (
    <>
      <div className="tool-intro">
        <span className="tool-number">04 / LOG ANALYSIS</span>
        <h1>{t("logs")}</h1>
        <p>{t("logsDesc")}</p>
      </div>
      <div className="panel tool-form">
        <div className="section-heading tight">
          <span className="privacy-pill">{t("local")}</span>
          <button
            className="text-button"
            onClick={() => {
              const value = new File([sampleLogs()], "demo.jsonl", {
                type: "text/plain"
              });
              void choose(value);
              setFormat("jsonl");
              run(value, "jsonl");
            }}
          >
            <FlaskConical size={16} />
            {t("sample")}
          </button>
        </div>
        <label
          className="drop-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) void choose(e.dataTransfer.files[0]);
          }}
        >
          <FileUp size={32} strokeWidth={1.5} />
          <strong>{file ? file.name : t("dropLogs")}</strong>
          <span>{t("logLimit")}</span>
          <input
            type="file"
            accept=".log,.txt,.jsonl,.ndjson"
            onChange={(e) => {
              const value = e.target.files?.[0];
              if (value) void choose(value);
              e.target.value = "";
            }}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            {t("format")}
            <select
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as "combined" | "jsonl")
              }
            >
              <option value="combined">Apache / Nginx Combined</option>
              <option value="jsonl">JSONL / NDJSON</option>
            </select>
          </label>
          <label className="field">
            {t("timezone")}
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              {[
                "UTC",
                "Asia/Riyadh",
                "Asia/Aden",
                "Europe/London",
                "America/New_York",
                "Asia/Dubai"
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        {format === "jsonl" && (
          <fieldset className="mapping">
            <legend>{t("mapping")}</legend>
            <div className="form-grid mapping-grid">
              {(Object.keys(mapping) as (keyof LogMapping)[]).map((key) => (
                <label className="field" key={key}>
                  {t(
                    (
                      {
                        time: "timeField",
                        ip: "ipField",
                        path: "pathField",
                        status: "statusField",
                        event: "eventField"
                      } as const
                    )[key]
                  )}
                  <input
                    value={mapping[key]}
                    maxLength={100}
                    dir="ltr"
                    onChange={(e) =>
                      setMapping({ ...mapping, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {preview && (
          <details className="file-preview">
            <summary>{t("preview")}</summary>
            <pre>{preview}</pre>
          </details>
        )}
        <div className="actions form-actions">
          <button
            className="button primary"
            onClick={() => run()}
            disabled={!file || busy}
          >
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <ListFilter size={18} />
            )}{" "}
            {busy ? t("analyzing") : t("analyze")}
          </button>
          {busy && (
            <>
              <button
                className="button secondary"
                onClick={() => {
                  worker.current?.terminate();
                  setBusy(false);
                  setError(t("cancelled"));
                }}
              >
                {t("cancel")}
              </button>
              <span role="status">{progress}%</span>
            </>
          )}
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
      </div>
      {summary && (
        <>
          <div className="panel">
            <div className="section-heading">
              <h3>{t("timeline")}</h3>
              <span className="muted small">
                {summary.total.toLocaleString(lang)} {t("rows")} ·{" "}
                {t("invalidLines")}: {summary.invalid}
              </span>
            </div>
            <div className="timeline" role="img" aria-label={t("timeline")}>
              {summary.timeline.slice(0, 120).map((bin) => (
                <div
                  className="timeline-column"
                  key={bin.time}
                  title={`${new Date(bin.time).toISOString()}: ${bin.count} / ${bin.errors}`}
                >
                  <div
                    className="timeline-bar"
                    style={{ height: Math.max(3, (bin.count / max) * 120) }}
                  />
                  <small>
                    {new Date(bin.time).toISOString().slice(11, 16)}
                  </small>
                </div>
              ))}
            </div>
            {summary.examples.length > 0 && (
              <details>
                <summary>{t("invalidLines")}</summary>
                {summary.examples.map((value, index) => (
                  <pre key={index}>{value}</pre>
                ))}
              </details>
            )}
          </div>
          <div className="panel">
            <h3>
              <ListFilter size={18} />
              {t("filter")}
            </h3>
            <div className="form-grid filters">
              {(["ip", "path", "status"] as const).map((key) => (
                <label className="field" key={key}>
                  {t(key)}
                  <input
                    dir="ltr"
                    value={filters[key] ?? ""}
                    maxLength={200}
                    onChange={(e) => updateFilter(key, e.target.value)}
                  />
                </label>
              ))}
              {(["from", "to"] as const).map((key) => (
                <label className="field" key={key}>
                  {t(key)}
                  <input
                    type="datetime-local"
                    value={filters[key]?.replace(/Z$/, "") ?? ""}
                    onChange={(e) =>
                      updateFilter(
                        key,
                        e.target.value ? e.target.value + "Z" : ""
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <div className="section-heading tight">
              <span className="muted small">
                {count.toLocaleString(lang)} {t("rows")}
              </span>
              <button
                className="text-button"
                onClick={() =>
                  worker.current?.postMessage({ type: "csv", filters })
                }
              >
                <Download size={16} />
                {t("exportFiltered")}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {(["time", "ip", "path", "status", "event"] as const).map(
                      (key) => (
                        <th key={key}>{t(key)}</th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td className="mono">
                        {new Date(row.time)
                          .toISOString()
                          .replace("T", " ")
                          .replace(".000Z", "")}
                      </td>
                      <td className="mono">{row.ip}</td>
                      <td className="mono value">{row.path}</td>
                      <td>
                        <span
                          className={
                            "http-code " + (row.status >= 400 ? "bad" : "good")
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{row.event}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button
                className="button secondary small-btn"
                disabled={page === 0}
                onClick={() =>
                  worker.current?.postMessage({
                    type: "page",
                    filters,
                    page: page - 1
                  })
                }
              >
                {t("previous")}
              </button>
              <span>
                {page + 1} / {Math.max(1, Math.ceil(count / 50))}
              </span>
              <button
                className="button secondary small-btn"
                disabled={(page + 1) * 50 >= count}
                onClick={() =>
                  worker.current?.postMessage({
                    type: "page",
                    filters,
                    page: page + 1
                  })
                }
              >
                {t("next")}
              </button>
            </div>
            <p className="muted small">
              {text(
                "تعرض الصفحة 50 حدثًا؛ تبقى بقية البيانات داخل مهمة المعالجة.",
                "Each page shows 50 events; remaining data stays in the processing worker."
              )}
            </p>
          </div>
          <ReportView report={summary.report} />
        </>
      )}
    </>
  );
}
