import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  FileUp,
  FlaskConical,
  Globe,
  LoaderCircle
} from "lucide-react";
import {
  analyzeHeaders,
  parseHar,
  parseHeaders,
  SAMPLE_HEADERS,
  type HeaderInput
} from "@cyberlab/core/headers";
import { reportSchema, type Report } from "@cyberlab/core/report";
import { useLab } from "../context";
import { errorText } from "../messages";
import ReportView from "../components/ReportView";
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>
      ) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}
export default function WebTool() {
  const { lang, t, text, addReport } = useLab(),
    [mode, setMode] = useState("live"),
    [url, setUrl] = useState(""),
    [raw, setRaw] = useState(""),
    [result, setResult] = useState<Report>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [entries, setEntries] = useState<HeaderInput[]>([]),
    [entry, setEntry] = useState(0),
    [invalid, setInvalid] = useState(0),
    [retry, setRetry] = useState("");
  const [config, setConfig] = useState<{
      liveScanEnabled: boolean;
      turnstileSiteKey: string;
    } | null>(null),
    [token, setToken] = useState("");
  const challenge = useRef<HTMLDivElement>(null),
    widget = useRef<string | undefined>(undefined),
    abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/config", { signal: controller.signal })
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ liveScanEnabled: false, turnstileSiteKey: "" }));
    return () => {
      controller.abort();
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (mode !== "live" || !config?.liveScanEnabled || !challenge.current)
      return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !challenge.current || !window.turnstile) return;
      widget.current = window.turnstile.render(challenge.current, {
        sitekey: config.turnstileSiteKey,
        action: "web-scan",
        language: lang,
        callback: (value: string) => setToken(value),
        "expired-callback": () => setToken(""),
        "error-callback": () => {
          setToken("");
          setError(errorText("CHALLENGE_REJECTED", lang));
        }
      });
    };
    if (window.turnstile) render();
    else {
      let script = document.getElementById(
        "turnstile-script"
      ) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "turnstile-script";
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        document.head.append(script);
      }
      script.addEventListener("load", render, { once: true });
    }
    return () => {
      cancelled = true;
      if (widget.current) {
        window.turnstile?.remove(widget.current);
        widget.current = undefined;
      }
      setToken("");
    };
  }, [mode, config?.liveScanEnabled, config?.turnstileSiteKey, lang]);
  const display = (report: Report) => {
    setResult(report);
    addReport(report);
  };
  const sample = () => {
    setMode("import");
    setRaw(SAMPLE_HEADERS);
    setUrl("https://demo.cyberlab.test/");
    setEntries([]);
    setError("");
    display(
      analyzeHeaders({
        url: "https://demo.cyberlab.test/",
        ...parseHeaders(SAMPLE_HEADERS),
        source: "demo"
      })
    );
  };
  const imported = async (file: File) => {
    setError("");
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
      const content = await file.text();
      if (
        file.name.toLowerCase().endsWith(".har") ||
        content.trim().startsWith("{")
      ) {
        const values = parseHar(content);
        if (!values.length) throw new Error("INVALID_HAR");
        setEntries(values);
        setEntry(0);
        setUrl(values[0].url);
        setRaw(values[0].headers.map(([n, v]) => n + ": " + v).join("\n"));
      } else {
        setEntries([]);
        setRaw(content);
      }
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : "INVALID_HAR", lang));
    }
  };
  const analyze = async () => {
    setError("");
    setInvalid(0);
    setRetry("");
    if (mode === "import") {
      try {
        const parsed = parseHeaders(raw);
        if (!parsed.headers.length) throw new Error("INVALID_REQUEST");
        setInvalid(parsed.invalid);
        display(
          analyzeHeaders({
            url: url || "https://imported.invalid/",
            ...parsed,
            status: entries[entry]?.status ?? parsed.status,
            source: "import"
          })
        );
      } catch (e) {
        setError(
          errorText(e instanceof Error ? e.message : "INVALID_REQUEST", lang)
        );
      }
      return;
    }
    if (!token) {
      setError(t("challenge"));
      return;
    }
    setBusy(true);
    abort.current = new AbortController();
    try {
      const response = await fetch("/api/v1/web-scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, turnstileToken: token }),
        signal: abort.current.signal
      });
      const json = await response.json();
      if (!response.ok) {
        const wait = response.headers.get("retry-after");
        if (wait) setRetry(wait + " " + text("ثانية", "seconds"));
        throw new Error(json.error?.code ?? "SCAN_UNAVAILABLE");
      }
      display(reportSchema.parse(json));
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          errorText(e instanceof Error ? e.message : "SCAN_UNAVAILABLE", lang)
        );
    } finally {
      setBusy(false);
      setToken("");
      if (widget.current) window.turnstile?.reset(widget.current);
    }
  };
  return (
    <>
      <div className="tool-intro">
        <span className="tool-number">01 / WEB SECURITY</span>
        <h1>{t("web")}</h1>
        <p>{t("webDesc")}</p>
      </div>
      <div className="panel tool-form">
        <div className="section-heading tight">
          <div className="segmented">
            <button
              className={mode === "live" ? "active" : ""}
              aria-pressed={mode === "live"}
              onClick={() => setMode("live")}
            >
              <Globe size={16} />
              {t("live")}
            </button>
            <button
              className={mode === "import" ? "active" : ""}
              aria-pressed={mode === "import"}
              onClick={() => setMode("import")}
            >
              <FileUp size={16} />
              {t("importHeaders")}
            </button>
          </div>
          <button className="text-button" onClick={sample}>
            <FlaskConical size={16} />
            {t("sample")}
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void analyze();
          }}
        >
          <label className="field">
            {t("urlLabel")}
            <input
              dir="ltr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.org"
              maxLength={4096}
              required={mode === "live"}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {mode === "import" ? (
            <>
              <div className="section-heading tight">
                <p className="muted small">{t("headersHint")}</p>
                <label className="file-button">
                  <FileUp size={16} />
                  {t("importFile")}
                  <input
                    type="file"
                    accept=".har,.txt,.json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void imported(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {entries.length > 0 && (
                <label className="field">
                  {t("harEntry")}
                  <select
                    value={entry}
                    onChange={(e) => {
                      const index = +e.target.value;
                      setEntry(index);
                      setUrl(entries[index].url);
                      setRaw(
                        entries[index].headers
                          .map(([n, v]) => n + ": " + v)
                          .join("\n")
                      );
                    }}
                  >
                    {entries.map((item, index) => (
                      <option value={index} key={index}>
                        {item.status} · {item.url.slice(0, 100)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field">
                {t("rawHeaders")}
                <textarea
                  dir="ltr"
                  className="code-input"
                  rows={10}
                  value={raw}
                  onChange={(e) => {
                    setRaw(e.target.value);
                    setEntries([]);
                  }}
                  required
                  maxLength={1024 * 1024}
                  placeholder="Content-Type: text/html"
                />
              </label>
            </>
          ) : (
            <>
              <p className="muted small">{t("scanHint")}</p>
              {config && !config.liveScanEnabled ? (
                <div className="notice">
                  {t("scanUnavailable")}{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setMode("import")}
                  >
                    {t("importHeaders")}
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div ref={challenge} className="challenge" />
              )}
            </>
          )}
          <div className="actions form-actions">
            <button
              className="button primary"
              type="submit"
              disabled={busy || (mode === "live" && !config?.liveScanEnabled)}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Globe size={18} />
              )}{" "}
              {busy ? t("analyzing") : t("analyze")}
            </button>
            {busy && (
              <button
                type="button"
                className="button secondary"
                onClick={() => abort.current?.abort()}
              >
                {t("cancel")}
              </button>
            )}
            <span className="privacy-pill">
              {mode === "import" ? t("local") : t("network")}
            </span>
          </div>
        </form>
        {error && (
          <div className="notice error" role="alert">
            {error} {retry}
          </div>
        )}
        {invalid > 0 && (
          <p className="muted">
            {t("invalidLines")}: {invalid}
          </p>
        )}
      </div>
      {result && <ReportView report={result} />}
    </>
  );
}
