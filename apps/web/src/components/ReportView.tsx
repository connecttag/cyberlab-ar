import { useState } from "react";
import {
  ArrowDownToLine,
  CheckCheck,
  ChevronDown,
  FileText,
  Save,
  ShieldCheck
} from "lucide-react";
import { summarize, type CheckState, type Report } from "@cyberlab/core/report";
import { useLab } from "../context";
import { saveReport } from "../lib/storage";
import { errorText } from "../messages";
import { download } from "../lib/download";
export default function ReportView({
  report,
  actions = true
}: {
  report: Report;
  actions?: boolean;
}) {
  const { lang, t, text, navigate, notify } = useLab(),
    [all, setAll] = useState(false),
    [filter, setFilter] = useState("all");
  const stats = summarize(report);
  const rows = all ? report.observations : report.observations.slice(0, 12);
  const findings = report.findings.filter(
    (x) =>
      filter === "all" ||
      (filter === "attention" && ["warn", "fail"].includes(x.state)) ||
      (filter === "pass" && x.state === "pass") ||
      (filter === "untested" && ["untested", "na"].includes(x.state))
  );
  const save = async () => {
    try {
      await saveReport(report);
      notify(t("saved"));
    } catch (error) {
      notify(
        errorText(
          error instanceof Error && error.message === "STORAGE_FULL"
            ? "STORAGE_FULL"
            : "STORAGE_UNAVAILABLE",
          lang
        )
      );
    }
  };
  const json = async () => {
    const { sanitizeReport } = await import("@cyberlab/core/exports");
    download(
      "cyberlab-" + report.toolId + ".json",
      JSON.stringify(sanitizeReport(report), null, 2),
      "application/json"
    );
  };
  return (
    <section className="report" aria-label={t("result")}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t("result")}</span>
          <h2>{report.title[lang]}</h2>
          <p className="muted small">
            {new Date(report.createdAt).toLocaleString(lang)} · {t("version")}{" "}
            {report.engineVersion} ·{" "}
            {
              {
                local: text("محلي", "Local"),
                import: text("مستورد", "Imported"),
                demo: text("مثال تجريبي", "Demo"),
                live: t("live")
              }[report.source]
            }
          </p>
        </div>
        {actions && (
          <div className="actions">
            <button
              className="button secondary small-btn"
              onClick={() => void save()}
            >
              <Save size={16} />
              {t("save")}
            </button>
            <button
              className="icon-button"
              title={t("json")}
              aria-label={t("download") + " JSON"}
              onClick={() => void json()}
            >
              <ArrowDownToLine size={18} />
            </button>
            <button
              className="button secondary small-btn"
              onClick={() => navigate("reports")}
            >
              <FileText size={16} />
              {t("sendStudio")}
            </button>
          </div>
        )}
      </div>
      {report.status !== "complete" && (
        <div className="notice warning" role="status">
          {t("partial")}
        </div>
      )}
      <div className="check-stats">
        {(Object.keys(stats) as CheckState[]).map((state) => (
          <div key={state} className={"check-stat " + state}>
            <strong>{stats[state]}</strong>
            <span>{t(state)}</span>
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="panel observations">
          <h3>
            <ShieldCheck size={18} />
            {t("observations")}
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("observations")}</th>
                  <th>{t("value")}</th>
                  <th>{text("الدقة", "Precision")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label[lang]}</th>
                    <td className="mono value">
                      {row.value === true
                        ? "✓"
                        : row.value === false
                          ? "✕"
                          : String(row.value ?? "—")}
                    </td>
                    <td>
                      <span className={"precision " + row.kind}>
                        {t(
                          row.kind === "unavailable" ? "unavailable" : row.kind
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.observations.length > 12 && (
            <button className="text-button" onClick={() => setAll(!all)}>
              {all ? t("showLess") : t("showAll")}
              <ChevronDown size={16} />
            </button>
          )}
        </div>
      )}
      {report.findings.length > 0 && (
        <>
          <div className="section-heading tight">
            <h3>
              <CheckCheck size={18} />
              {t("findings")}
            </h3>
            <div className="segmented" aria-label={t("filter")}>
              {(["all", "attention", "pass", "untested"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    aria-pressed={filter === tab}
                    className={filter === tab ? "active" : ""}
                    onClick={() => setFilter(tab)}
                  >
                    {t(tab)}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="findings">
            {findings.map((item) => (
              <details className={"finding " + item.state} key={item.ruleId}>
                <summary>
                  <span className={"status-dot " + item.state} />
                  <span className="finding-title">{item.title[lang]}</span>
                  <span className={"status-badge " + item.state}>
                    {t(item.state)}
                  </span>
                  <ChevronDown size={16} />
                </summary>
                <div className="finding-body">
                  <p>{item.explanation[lang]}</p>
                  <span className="muted small">
                    {t("priority")}: {t(item.priority)}
                  </span>
                  <h4>{t("evidence")}</h4>
                  <pre>{item.evidence}</pre>
                  <h4>{t("fix")}</h4>
                  <p>{item.remediation[lang]}</p>
                  {item.snippets.length > 0 && (
                    <details className="snippets">
                      <summary>{t("examples")}</summary>
                      {item.snippets.map((snippet) => (
                        <div key={snippet.platform}>
                          <h4>{snippet.platform}</h4>
                          <pre>{snippet.code}</pre>
                        </div>
                      ))}
                    </details>
                  )}
                  {item.references.length > 0 && (
                    <div className="references">
                      {item.references
                        .filter((x) => /^https?:\/\//i.test(x))
                        .map((href, index) => (
                          <a
                            key={index}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t("references")} {index + 1} ↗
                          </a>
                        ))}
                    </div>
                  )}
                  <code className="rule-id">{item.ruleId}</code>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
      <div className="notice limitations">
        <h3>{t("limitations")}</h3>
        <ul>
          {report.limitations.map((item, index) => (
            <li key={index}>{item[lang]}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
