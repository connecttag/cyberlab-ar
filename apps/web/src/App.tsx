import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ReactNode
} from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Braces,
  ChevronRight,
  FileText,
  Fingerprint,
  Globe,
  LayoutGrid,
  Link2,
  ListFilter,
  LockKeyhole,
  Menu,
  Shield,
  ShieldCheck,
  Sparkles,
  WifiOff,
  X,
  Download
} from "lucide-react";
import { Context } from "./context";
import { translate, type MessageKey } from "./messages";
import type { Language, Report } from "@cyberlab/core/report";
const WebTool = lazy(() => import("./tools/WebTool")),
  UrlTool = lazy(() => import("./tools/UrlTool")),
  BrowserTool = lazy(() => import("./tools/BrowserTool")),
  LogsTool = lazy(() => import("./tools/LogsTool")),
  ReportsTool = lazy(() => import("./tools/ReportsTool"));
const tools = [
  {
    id: "web",
    icon: Globe,
    key: "web",
    desc: "webDesc",
    tag: "network",
    number: "01"
  },
  {
    id: "url",
    icon: Link2,
    key: "url",
    desc: "urlDesc",
    tag: "local",
    number: "02"
  },
  {
    id: "browser",
    icon: Fingerprint,
    key: "browser",
    desc: "browserDesc",
    tag: "local",
    number: "03"
  },
  {
    id: "logs",
    icon: ListFilter,
    key: "logs",
    desc: "logsDesc",
    tag: "local",
    number: "04"
  },
  {
    id: "reports",
    icon: FileText,
    key: "reports",
    desc: "reportsDesc",
    tag: "local",
    number: "05"
  }
] as const;
function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preferences are optional */
  }
}
function route() {
  const parts = location.pathname.split("/").filter(Boolean);
  return {
    lang: parts[0] === "en" ? ("en" as const) : ("ar" as const),
    page: tools.some((x) => x.id === parts[1]) ? parts[1] : "home"
  };
}
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="notice error">
        <p>
          تعذر عرض هذه الصفحة. يمكنك إعادة تحميلها. / This view could not be
          displayed.
        </p>
        <button className="button secondary" onClick={() => location.reload()}>
          إعادة تحميل / Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [current, setCurrent] = useState(route),
    [theme, setTheme] = useState(stored("cyberlab-theme", "system")),
    [reports, setReports] = useState<Report[]>([]),
    [toast, setToast] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [update, setUpdate] = useState<ServiceWorker | null>(null),
    [install, setInstall] = useState<InstallPrompt | null>(null),
    [showHelp, setShowHelp] = useState(false);
  const { lang, page } = current,
    t = (key: MessageKey) => translate(key, lang),
    text = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const navigate = (next: string) => {
    history.pushState({}, "", `/${lang}${next === "home" ? "" : "/" + next}`);
    setCurrent({ lang, page: next });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const changeLanguage = () => {
    const next: Language = lang === "ar" ? "en" : "ar";
    remember("cyberlab-lang", next);
    history.pushState({}, "", `/${next}${page === "home" ? "" : "/" + page}`);
    setCurrent({ lang: next, page });
  };
  useEffect(() => {
    const pop = () => setCurrent(route()),
      offline = () => setOnline(navigator.onLine),
      prompt = (event: Event) => {
        event.preventDefault();
        setInstall(event as InstallPrompt);
      };
    window.addEventListener("popstate", pop);
    window.addEventListener("online", offline);
    window.addEventListener("offline", offline);
    window.addEventListener("beforeinstallprompt", prompt);
    if (location.pathname === "/") {
      const value = stored("cyberlab-lang", "ar") === "en" ? "en" : "ar";
      history.replaceState({}, "", "/" + value);
      setCurrent({ lang: value, page: "home" });
    }
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("online", offline);
      window.removeEventListener("offline", offline);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = "CyberLab — " + t(page as MessageKey);
  }, [lang, page]);
  useEffect(() => {
    remember("cyberlab-theme", theme);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    updateTheme();
    media.addEventListener("change", updateTheme);
    return () => media.removeEventListener("change", updateTheme);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) setUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setUpdate(worker);
          });
        });
      })
      .catch(() => {});
    let hadController = !!navigator.serviceWorker.controller;
    const reload = () => {
      // The first installation must not erase an in-memory report or form.
      // A user-approved update replaces an existing controller and reloads.
      if (hadController) location.reload();
      else hadController = true;
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", reload);
  }, []);
  return (
    <Context.Provider
      value={{
        lang,
        reports,
        addReport: (report) =>
          setReports((previous) =>
            [
              report,
              ...previous.filter((x) => x.reportId !== report.reportId)
            ].slice(0, 20)
          ),
        navigate,
        notify: setToast
      }}
    >
      <a className="skip-link" href="#main">
        {text("انتقل إلى المحتوى", "Skip to content")}
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <button
            className="brand"
            onClick={() => navigate("home")}
            aria-label="CyberLab"
          >
            <span className="brand-mark">
              <ShieldCheck size={27} strokeWidth={1.7} />
            </span>
            <span>
              <b dir="ltr">
                CyberLab<span className="brand-dot">.</span>
              </b>
              <small>{t("brand")}</small>
            </span>
          </button>
          <span className="nav-caption">
            {text("مساحة العمل", "WORKSPACE")}
          </span>
          <nav aria-label={text("التنقل الرئيسي", "Main navigation")}>
            <button
              className={"nav-item " + (page === "home" ? "selected" : "")}
              onClick={() => navigate("home")}
              aria-current={page === "home" ? "page" : undefined}
            >
              <LayoutGrid size={19} />
              <span>{t("home")}</span>
            </button>
            {tools.map((tool) => (
              <button
                key={tool.id}
                className={"nav-item " + (page === tool.id ? "selected" : "")}
                aria-current={page === tool.id ? "page" : undefined}
                onClick={() => navigate(tool.id)}
              >
                <tool.icon size={19} />
                <span>{t(tool.key)}</span>
                {tool.id === "reports" && reports.length > 0 && (
                  <span className="count-pill">{reports.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="privacy-note">
              <LockKeyhole size={19} />
              <strong>{t("privacy")}</strong>
              <p>{t("privateNote")}</p>
            </div>
            <button className="help-link" onClick={() => setShowHelp(true)}>
              <Braces size={16} />
              {t("help")}
              <ArrowUpRight size={15} />
            </button>
            <span className="version-label">CYBERLAB / V1.0</span>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumbs">
              <Shield size={16} />
              <span>CyberLab</span>
              <ChevronRight size={13} />
              <strong>{t(page as MessageKey)}</strong>
            </div>
            <div className="top-actions">
              {install && (
                <button
                  className="icon-button"
                  aria-label={t("install")}
                  title={t("install")}
                  onClick={() =>
                    void install.prompt().then(() => setInstall(null))
                  }
                >
                  <Download size={18} />
                </button>
              )}
              <label className="theme-select">
                <span className="sr-only">{t("theme")}</span>
                <select
                  aria-label={t("theme")}
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                >
                  {(["system", "light", "dark"] as const).map((value) => (
                    <option key={value} value={value}>
                      {t(value)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="language-button"
                onClick={changeLanguage}
                lang={lang === "ar" ? "en" : "ar"}
              >
                {t("language")}
              </button>
            </div>
          </header>
          {!online && (
            <div className="connectivity-banner" role="status">
              <WifiOff size={16} />
              {t("offline")}
            </div>
          )}
          {update && (
            <div className="connectivity-banner">
              {t("update")}
              <button
                className="text-button"
                onClick={() => update.postMessage("SKIP_WAITING")}
              >
                {t("reload")}
              </button>
            </div>
          )}
          <main id="main" tabIndex={-1}>
            {page === "home" ? (
              <>
                <div className="page-heading">
                  <span className="eyebrow">
                    {text(
                      "أهلًا بك في مساحة التحليل",
                      "WELCOME TO YOUR ANALYSIS WORKSPACE"
                    )}
                  </span>
                  <h1>{t("home")}</h1>
                  <p>
                    {text(
                      "من المشاهدة الأولى إلى تقرير قابل للمشاركة.",
                      "From first observation to a report ready to share."
                    )}
                  </p>
                </div>
                <section className="hero">
                  <div className="hero-copy">
                    <span className="hero-badge">
                      <span className="pulse-dot" />
                      LOCAL FIRST. CONTEXT ALWAYS.
                    </span>
                    <h2>{t("heroTitle")}</h2>
                    <p>{t("heroDesc")}</p>
                    <div className="actions">
                      <button
                        className="button mint"
                        onClick={() => navigate("web")}
                      >
                        {t("start")}
                        {lang === "ar" ? (
                          <ArrowLeft size={18} />
                        ) : (
                          <ArrowRight size={18} />
                        )}
                      </button>
                      <a className="hero-secondary" href="#toolkit">
                        {t("explore")}
                        <ArrowUpRight size={16} />
                      </a>
                    </div>
                  </div>
                  <div className="hero-visual" aria-hidden="true">
                    <div className="terminal">
                      <div className="terminal-top">
                        <div>
                          <i />
                          <i />
                          <i />
                        </div>
                        <span>cyberlab / response.inspect</span>
                        <LockKeyhole size={12} />
                      </div>
                      <div className="terminal-content">
                        <p className="terminal-comment">
                          // observe · explain · verify
                        </p>
                        <p>
                          <span className="terminal-green">HTTP/2</span>{" "}
                          <span className="terminal-white">200 OK</span>
                        </p>
                        <p>
                          content-type: <span>text/html</span>
                        </p>
                        <p>
                          strict-transport-security:{" "}
                          <span>max-age=31536000</span>
                        </p>
                        <p>
                          referrer-policy:{" "}
                          <span>strict-origin-when-cross-origin</span>
                        </p>
                        <div className="terminal-divider" />
                        <p className="terminal-comment">analysis.complete</p>
                        <p>
                          <span className="terminal-green">✓</span> Evidence
                          collected
                        </p>
                        <p>
                          <span className="terminal-green">✓</span> Report stays
                          on your device
                        </p>
                      </div>
                    </div>
                    <div className="visual-float">
                      <ShieldCheck size={24} />
                      <div>
                        <b>
                          {text(
                            "وضوح قبل الحكم",
                            "Evidence before conclusions"
                          )}
                        </b>
                        <small>
                          {text("فحوص قابلة للتفسير", "Explainable checks")}
                        </small>
                      </div>
                    </div>
                    <div className="orbit-line" />
                  </div>
                </section>
                <div className="feature-strip">
                  <span>
                    <ShieldCheck size={17} />
                    {t("noAccount")}
                  </span>
                  <span>
                    <Braces size={17} />
                    {t("fiveTools")}
                  </span>
                  <span>
                    <Globe size={17} />
                    {t("twoLanguages")}
                  </span>
                  <span>
                    <LockKeyhole size={17} />
                    {t("localReports")}
                  </span>
                </div>
                <section id="toolkit">
                  <div className="section-heading toolkit-heading">
                    <div>
                      <span className="eyebrow">
                        {text("ابدأ من هنا", "START HERE")}
                      </span>
                      <h2>{t("tools")}</h2>
                      <p className="muted">{t("choose")}</p>
                    </div>
                    <span className="tool-total">
                      05 <span>{text("أدوات", "TOOLS")}</span>
                    </span>
                  </div>
                  <div className="tools-grid">
                    {tools.map((tool) => (
                      <button
                        className={"tool-card " + tool.id}
                        key={tool.id}
                        onClick={() => navigate(tool.id)}
                      >
                        <div className="card-top">
                          <span className="tool-icon">
                            <tool.icon size={25} strokeWidth={1.6} />
                          </span>
                          <span className="card-number">{tool.number}</span>
                        </div>
                        <h3>{t(tool.key)}</h3>
                        <p>{t(tool.desc)}</p>
                        <div className="card-footer">
                          <span className={"processing-badge " + tool.tag}>
                            {tool.tag === "local" ? (
                              <LockKeyhole size={12} />
                            ) : (
                              <Globe size={12} />
                            )}{" "}
                            {t(tool.tag)}
                          </span>
                          <ArrowUpRight size={20} />
                        </div>
                      </button>
                    ))}
                    <div className="workflow-card">
                      <Sparkles size={23} />
                      <h3>
                        {text("أدوات تتكامل معًا", "A connected workflow")}
                      </h3>
                      <p>
                        {text(
                          "حلّل، اجمع الأدلة، ثم جهّز تقريرك في مساحة واحدة.",
                          "Analyze, collect evidence, and prepare your report in one workspace."
                        )}
                      </p>
                      <span>01 → 02 → 05</span>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <Boundary key={page}>
                <Suspense
                  fallback={
                    <div className="loading-state">
                      <span className="loader" />
                      {text("جارٍ تجهيز الأداة…", "Preparing the tool…")}
                    </div>
                  }
                >
                  {page === "web" ? (
                    <WebTool />
                  ) : page === "url" ? (
                    <UrlTool />
                  ) : page === "browser" ? (
                    <BrowserTool />
                  ) : page === "logs" ? (
                    <LogsTool />
                  ) : (
                    <ReportsTool />
                  )}
                </Suspense>
              </Boundary>
            )}
          </main>
          <footer>
            <span>© 2026 CyberLab</span>
            <span>{t("footer")}</span>
            <span className="footer-status">
              <span className="status-dot pass" /> {t("localReports")}
            </span>
          </footer>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            className="icon-button"
            aria-label={text("إغلاق", "Close")}
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label={t("help")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <h2>{t("help")}</h2>
              <button
                className="icon-button"
                autoFocus
                aria-label={text("إغلاق", "Close")}
                onClick={() => setShowHelp(false)}
              >
                <X />
              </button>
            </div>
            <p>{t("privateNote")}</p>
            <p>
              {text(
                "كل فحص يعرض مشاهداته وحدوده. لا تعني الملاحظة وحدها ثغرة مثبتة، ولا يعني نجاح فحوص الترويسات أمان الموقع بالكامل.",
                "Each audit shows its observations and limitations. A finding alone is not a proven vulnerability, and passing header checks does not establish overall site security."
              )}
            </p>
            <p>{t("storageNote")}</p>
            <p>
              {text(
                "تعالج Cloudflare طلبات الشبكة وحماية Turnstile وفق سياساتها المستقلة. لا تحفظ المنصة تقارير الفحص في قاعدة البيانات.",
                "Cloudflare processes network requests and Turnstile protection under its own policies. The application does not persist audit reports in its database."
              )}
            </p>
          </section>
        </div>
      )}
    </Context.Provider>
  );
}
