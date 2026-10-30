import { useEffect, useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  FlaskConical,
  Link2,
  ScanQrCode
} from "lucide-react";
import { analyzeUrl } from "@cyberlab/core/urls";
import type { Report } from "@cyberlab/core/report";
import { useLab } from "../context";
import { errorText } from "../messages";
import ReportView from "../components/ReportView";
export default function UrlTool() {
  const { lang, t, text, addReport, notify } = useLab();
  const [input, setInput] = useState(""),
    [second, setSecond] = useState(""),
    [report, setReport] = useState<Report>(),
    [compared, setCompared] = useState<Report>(),
    [error, setError] = useState(""),
    [qr, setQr] = useState(""),
    [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const run = (value = input, other = second) => {
    setError("");
    try {
      const result = analyzeUrl(value);
      const comparison = other.trim() ? analyzeUrl(other) : undefined;
      setReport(result);
      setCompared(comparison);
      addReport(result);
      if (comparison) addReport(comparison);
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : "INVALID_URL", lang));
    }
  };
  const readQr = (file: File) => {
    worker.current?.terminate();
    setBusy(true);
    setError("");
    worker.current = new Worker(
      new URL("../workers/qr.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.current.onmessage = ({ data }) => {
      setBusy(false);
      if (data.error) setError(errorText(data.error, lang));
      else setQr(data.text);
      worker.current?.terminate();
    };
    worker.current.onerror = () => {
      setBusy(false);
      setError(errorText("QR_UNAVAILABLE", lang));
      worker.current?.terminate();
    };
    worker.current.postMessage({ file });
  };
  let openHref = "";
  try {
    const value = new URL(input);
    if (
      ["http:", "https:"].includes(value.protocol) &&
      !value.username &&
      !value.password
    )
      openHref = value.href;
  } catch {
    /* not an openable URL */
  }
  return (
    <>
      <div className="tool-intro">
        <span className="tool-number">02 / LINKS & QR</span>
        <h1>{t("url")}</h1>
        <p>{t("urlDesc")}</p>
      </div>
      <div className="two-columns">
        <div className="panel tool-form">
          <div className="section-heading tight">
            <span className="privacy-pill">{t("local")}</span>
            <button
              className="text-button"
              onClick={() => {
                const value =
                  "https://login.accounts.example.org:8443/reset?token=demo-only&lang=ar";
                setInput(value);
                setSecond("https://accounts.example.org/reset?lang=en");
                run(value, "https://accounts.example.org/reset?lang=en");
              }}
            >
              <FlaskConical size={16} />
              {t("sample")}
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <label className="field">
              {t("urlLabel")}
              <input
                dir="ltr"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={4096}
                placeholder="https://example.org/path?key=value"
                required
                spellCheck={false}
              />
            </label>
            <label className="field">
              {t("secondUrl")}
              <input
                dir="ltr"
                value={second}
                onChange={(e) => setSecond(e.target.value)}
                maxLength={4096}
                placeholder="https://example.org/other"
                spellCheck={false}
              />
            </label>
            <button className="button primary" type="submit">
              <Link2 size={18} />
              {t("analyze")}
            </button>
          </form>
        </div>
        <div className="panel qr-panel">
          <ScanQrCode size={36} strokeWidth={1.4} />
          <h3>{t("qrUpload")}</h3>
          <p className="muted small">{t("qrHint")}</p>
          <label className="button secondary file-button">
            {busy ? t("analyzing") : t("importFile")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readQr(file);
                e.target.value = "";
              }}
            />
          </label>
          {qr && (
            <div className="qr-result">
              <label className="field">
                {t("qrContent")}
                <textarea readOnly rows={4} value={qr} dir="auto" />
              </label>
              <button
                className="text-button"
                onClick={() => setInput(qr.slice(0, 4096))}
              >
                {t("useQr")}
              </button>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {report && (
        <>
          <div className="actions result-links">
            <button
              className="button secondary small-btn"
              onClick={() =>
                void navigator.clipboard
                  .writeText(report.target)
                  .then(() => notify(t("copied")))
                  .catch(() =>
                    notify(
                      text(
                        "تعذر النسخ؛ حدد النص يدويًا.",
                        "Copy failed; select the text manually."
                      )
                    )
                  )
              }
            >
              <Copy size={16} />
              {t("copy")}
            </button>
            {openHref && (
              <a
                className="button secondary small-btn"
                href={openHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} />
                {t("openTarget")}
              </a>
            )}
          </div>
          {compared && (
            <div className="panel">
              <h3>{t("comparison")}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("observations")}</th>
                      <th>{t("before")}</th>
                      <th>{t("after")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.observations
                      .filter(
                        (row) =>
                          row.value !==
                          compared.observations.find((x) => x.key === row.key)
                            ?.value
                      )
                      .map((row) => (
                        <tr key={row.key}>
                          <th>{row.label[lang]}</th>
                          <td className="mono value">
                            {String(row.value ?? "—")}
                          </td>
                          <td className="mono value">
                            {String(
                              compared.observations.find(
                                (x) => x.key === row.key
                              )?.value ?? "—"
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <ReportView report={report} />
        </>
      )}
    </>
  );
}
