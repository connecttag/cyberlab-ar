import { useEffect, useMemo, useState } from "react";
import {
  FileDown,
  FileUp,
  FolderOpen,
  Trash2,
  GitCompareArrows,
  Printer
} from "lucide-react";
import { compareReports, type Report } from "@cyberlab/core/report";
import {
  combineReports,
  parseReports,
  sanitizeReport,
  reportHtml,
  reportMarkdown,
  reportCsv
} from "@cyberlab/core/exports";
import { useLab } from "../context";
import { deleteSaved, savedReports } from "../lib/storage";
import { download, printHtml } from "../lib/download";
import { errorText } from "../messages";
import ReportView from "../components/ReportView";
export default function ReportsTool() {
  const { lang, t, text, reports, addReport, notify } = useLab();
  const [saved, setSaved] = useState<Report[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [title, setTitle] = useState("CyberLab — " + t("result")),
    [author, setAuthor] = useState(""),
    [notes, setNotes] = useState(""),
    [mask, setMask] = useState(true),
    [generated, setGenerated] = useState<Report>(),
    [error, setError] = useState(""),
    [comparison, setComparison] = useState<ReturnType<typeof compareReports>>();
  const refresh = () =>
    savedReports()
      .then(setSaved)
      .catch(() => setError(errorText("STORAGE_UNAVAILABLE", lang)));
  useEffect(() => {
    void refresh();
  }, []);
  const available = useMemo(
    () =>
      [
        ...new Map([...saved, ...reports].map((r) => [r.reportId, r])).values()
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [saved, reports]
  );
  const chosen = available.filter((x) => selected.includes(x.reportId));
  const preview = generated ? sanitizeReport(generated, mask) : undefined;
  const imported = async (file: File) => {
    setError("");
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
      const parsed = parseReports(await file.text());
      parsed.forEach(addReport);
      setSelected(parsed.map((x) => x.reportId));
    } catch (e) {
      setError(
        errorText(e instanceof Error ? e.message : "INVALID_REPORT", lang)
      );
    }
  };
  const prepare = () => {
    setError("");
    try {
      const report =
        chosen.length === 1
          ? {
              ...structuredClone(chosen[0]),
              title: { ar: title, en: title },
              author,
              notes
            }
          : combineReports(chosen, title, author, notes);
      setGenerated(report);
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : "NO_REPORTS", lang));
    }
  };
  const exportFile = (format: "json" | "md" | "html" | "csv") => {
    if (!preview) return;
    const content =
      format === "json"
        ? JSON.stringify(preview, null, 2)
        : format === "md"
          ? reportMarkdown(preview, lang)
          : format === "csv"
            ? reportCsv(preview, lang)
            : reportHtml(preview, lang);
    download(
      "cyberlab-report." + format,
      content,
      format === "json"
        ? "application/json"
        : format === "html"
          ? "text/html;charset=utf-8"
          : format === "csv"
            ? "text/csv;charset=utf-8"
            : "text/markdown;charset=utf-8"
    );
  };
  return (
    <>
      <div className="tool-intro">
        <span className="tool-number">05 / REPORT STUDIO</span>
        <h1>{t("reports")}</h1>
        <p>{t("reportsDesc")}</p>
      </div>
      <div className="panel">
        <div className="section-heading">
          <div>
            <h3>
              <FolderOpen size={20} />
              {t("sessionReports")} / {t("history")}
            </h3>
            <p className="muted small">{t("reportHelp")}</p>
          </div>
          <label className="button secondary file-button">
            <FileUp size={16} />
            {t("importReport")}
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void imported(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {!available.length ? (
          <div className="empty-state">
            <FolderOpen size={36} />
            <p>{t("noReports")}</p>
          </div>
        ) : (
          <div className="report-list">
            {available.map((report) => (
              <div className="report-row" key={report.reportId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(report.reportId)}
                    disabled={
                      !selected.includes(report.reportId) &&
                      selected.length >= 20
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, report.reportId]
                          : selected.filter((x) => x !== report.reportId)
                      )
                    }
                  />
                  <span>
                    <strong>{report.title[lang]}</strong>
                    <small>
                      {new Date(report.createdAt).toLocaleString(lang)} ·{" "}
                      {report.toolId} · {report.engineVersion}
                    </small>
                    <small className="mono value">{report.target}</small>
                  </span>
                </label>
                {saved.some((x) => x.reportId === report.reportId) && (
                  <button
                    className="icon-button"
                    aria-label={t("delete")}
                    onClick={() =>
                      void deleteSaved(report.reportId)
                        .then(refresh)
                        .catch(() =>
                          notify(errorText("STORAGE_UNAVAILABLE", lang))
                        )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="section-heading tight">
          <p className="muted small">{t("storageNote")}</p>
          {saved.length > 0 && (
            <button
              className="text-button danger"
              onClick={() => {
                if (confirm(t("confirmDelete")))
                  void deleteSaved()
                    .then(refresh)
                    .catch(() =>
                      notify(errorText("STORAGE_UNAVAILABLE", lang))
                    );
              }}
            >
              <Trash2 size={15} />
              {t("clearHistory")}
            </button>
          )}
        </div>
      </div>
      <div className="panel tool-form">
        <div className="form-grid">
          <label className="field">
            {t("reportTitle")}
            <input
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            {t("author")}
            <input
              value={author}
              maxLength={200}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          {t("notes")}
          <textarea
            rows={3}
            value={notes}
            maxLength={12000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="actions">
          <button
            className="button primary"
            disabled={!chosen.length}
            onClick={prepare}
          >
            <FileDown size={18} />
            {t("createReport")} ({chosen.length})
          </button>
          <button
            className="button secondary"
            disabled={chosen.length !== 2}
            onClick={() =>
              setComparison(
                compareReports(
                  ...([...chosen].sort((a, b) =>
                    a.createdAt.localeCompare(b.createdAt)
                  ) as [Report, Report])
                )
              )
            }
          >
            <GitCompareArrows size={17} />
            {t("compareReports")}
          </button>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {comparison && (
        <div className="panel">
          <h3>{t("comparison")}</h3>
          {comparison.rulesChanged && (
            <div className="notice warning">{t("rulesChanged")}</div>
          )}
          {!comparison.compatible && (
            <div className="notice">{t("incompatible")}</div>
          )}
          <div className="check-stats">
            {(
              [
                "added",
                "removed",
                "changed",
                "observations",
                ...(comparison.compatible && !comparison.rulesChanged
                  ? (["resolved", "regressed"] as const)
                  : [])
              ] as const
            ).map((key) => (
              <div className="check-stat" key={key}>
                <strong>{comparison[key].length}</strong>
                <span>
                  {t(key === "observations" ? "changedObservations" : key)}
                </span>
              </div>
            ))}
          </div>
          {comparison.changed.map((item) => (
            <p key={item.ruleId}>
              {item.title[lang]}: {t(item.state)} <code>{item.ruleId}</code>
            </p>
          ))}
          {comparison.added.map((item) => (
            <p key={"added." + item.ruleId}>
              {t("added")}: {item.title[lang]}
            </p>
          ))}
          {comparison.removed.map((item) => (
            <p key={"removed." + item.ruleId}>
              {t("removed")}: {item.title[lang]}
            </p>
          ))}
          {comparison.observations.map((item) => (
            <p key={item.key}>
              {item.label[lang]}:{" "}
              <span className="mono">{String(item.value)}</span>
            </p>
          ))}
        </div>
      )}
      {preview && (
        <>
          <div className="panel export-panel">
            <div>
              <h3>{t("redactPreview")}</h3>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={mask}
                  onChange={(e) => setMask(e.target.checked)}
                />
                {t("mask")}
              </label>
              <p className="muted small">
                {text(
                  "راجع النص أدناه؛ التنقيح الآلي قد لا يتعرف على جميع البيانات الحساسة.",
                  "Review the text below; automatic redaction may not recognize every sensitive value."
                )}
              </p>
            </div>
            <div className="actions">
              {(["json", "md", "html", "csv"] as const).map((format) => (
                <button
                  className="button secondary small-btn"
                  key={format}
                  onClick={() => exportFile(format)}
                >
                  {format.toUpperCase()}
                </button>
              ))}
              <button
                className="button primary small-btn"
                onClick={() => printHtml(reportHtml(preview, lang))}
              >
                <Printer size={16} />
                {t("print")}
              </button>
            </div>
          </div>
          <ReportView report={preview} />
        </>
      )}
    </>
  );
}
