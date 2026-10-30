import {
  bi,
  makeReport,
  observation,
  finding,
  toolNames
} from "@cyberlab/core/report";
export function collectBrowserReport() {
  const report = makeReport("browser", toolNames.browser, "current browser");
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    globalPrivacyControl?: boolean;
    userAgentData?: {
      brands: { brand: string; version: string }[];
      platform: string;
      mobile: boolean;
    };
  };
  let storage = false;
  try {
    const key = "cyberlab-storage-probe-" + crypto.randomUUID();
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    storage = true;
  } catch {
    /* exposed as unavailable */
  }
  const values = [
    ["ua", "معرّف المتصفح", "User agent", nav.userAgent, "inferred"],
    [
      "platform",
      "النظام المعلن",
      "Reported platform",
      nav.userAgentData?.platform ?? nav.platform,
      "inferred"
    ],
    [
      "brands",
      "المتصفحات المعلنة",
      "Reported brands",
      nav.userAgentData?.brands
        .map((x) => x.brand + " " + x.version)
        .join(", ") ?? null,
      "inferred"
    ],
    ["languages", "اللغات", "Languages", nav.languages.join(", "), "direct"],
    [
      "timezone",
      "المنطقة الزمنية",
      "Time zone",
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      "direct"
    ],
    [
      "screen",
      "الشاشة",
      "Screen",
      `${screen.width} × ${screen.height}`,
      "direct"
    ],
    [
      "viewport",
      "مساحة الصفحة",
      "Viewport",
      `${innerWidth} × ${innerHeight}`,
      "direct"
    ],
    ["dpr", "كثافة البكسل", "Pixel ratio", devicePixelRatio, "direct"],
    ["touch", "نقاط اللمس", "Touch points", nav.maxTouchPoints, "direct"],
    [
      "cores",
      "المعالجات المنطقية المعلنة",
      "Reported logical processors",
      nav.hardwareConcurrency ?? null,
      "inferred"
    ],
    [
      "memory",
      "الذاكرة التقديرية GB",
      "Approximate memory GB",
      nav.deviceMemory ?? null,
      "inferred"
    ],
    [
      "color",
      "نمط الألوان المفضل",
      "Preferred color scheme",
      matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      "direct"
    ],
    ["secure", "سياق آمن", "Secure context", isSecureContext, "direct"],
    [
      "storage",
      "التخزين المحلي متاح",
      "Local storage available",
      storage,
      "direct"
    ],
    [
      "indexeddb",
      "دعم IndexedDB",
      "IndexedDB support",
      !!globalThis.indexedDB,
      "direct"
    ],
    [
      "cookies",
      "Cookies مفعلة بحسب المتصفح",
      "Cookies enabled per browser",
      nav.cookieEnabled,
      "direct"
    ],
    [
      "gpc",
      "إشارة الخصوصية العامة",
      "Global Privacy Control",
      nav.globalPrivacyControl ?? null,
      "direct"
    ],
    [
      "webrtc",
      "دعم WebRTC دون فتح اتصال",
      "WebRTC support, no connection opened",
      !!globalThis.RTCPeerConnection,
      "direct"
    ],
    [
      "workers",
      "دعم Web Workers",
      "Web Workers support",
      !!globalThis.Worker,
      "direct"
    ],
    [
      "offline",
      "حالة الاتصال المعلنة",
      "Reported online status",
      nav.onLine,
      "inferred"
    ]
  ] as const;
  for (const [key, ar, en, value, kind] of values)
    report.observations.push(
      observation(key, bi(ar, en), value, value === null ? "unavailable" : kind)
    );
  report.findings.push(
    finding(
      "browser.secure",
      isSecureContext ? "pass" : "warn",
      bi("السياق الآمن", "Secure context"),
      String(isSecureContext),
      bi(
        "تحتاج بعض واجهات الويب HTTPS أو بيئة تطوير محلية آمنة.",
        "Some web APIs require HTTPS or a trusted local development context."
      )
    )
  );
  report.limitations.push(
    bi(
      "هذه معلومات متاحة للصفحة وليست هوية ثابتة للجهاز. قد يخفض المتصفح دقتها أو يعدلها.",
      "These are page-visible properties, not a stable device identity. Browsers may reduce or alter them."
    ),
    bi(
      "لم يُطلب GPS أو كاميرا أو ميكروفون، ولم تُنشأ بصمة Canvas أو WebGL أو اتصال WebRTC.",
      "No location, camera, or microphone was requested. No Canvas/WebGL fingerprint or WebRTC connection was created."
    )
  );
  return report;
}
