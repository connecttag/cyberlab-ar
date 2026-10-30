import { useState } from "react";
import { Fingerprint, RefreshCw } from "lucide-react";
import type { Report } from "@cyberlab/core/report";
import { collectBrowserReport } from "../lib/browser";
import { useLab } from "../context";
import ReportView from "../components/ReportView";
export default function BrowserTool() {
  const { t, addReport } = useLab();
  const [report, setReport] = useState<Report>();
  return (
    <>
      <div className="tool-intro">
        <span className="tool-number">03 / BROWSER PRIVACY</span>
        <h1>{t("browser")}</h1>
        <p>{t("browserDesc")}</p>
      </div>
      <div className="panel browser-panel">
        <div className="privacy-orbit">
          <Fingerprint size={64} strokeWidth={1} />
        </div>
        <div>
          <span className="privacy-pill">{t("local")}</span>
          <h2>{t("inspectBrowser")}</h2>
          <p className="muted">{t("browserHint")}</p>
          <button
            className="button primary"
            onClick={() => {
              const result = collectBrowserReport();
              setReport(result);
              addReport(result);
            }}
          >
            <RefreshCw size={18} />
            {t("inspectBrowser")}
          </button>
        </div>
      </div>
      {report && <ReportView report={report} />}
    </>
  );
}
