import type { Language } from "@cyberlab/core/report";
export const messages = {
  brand: ["مختبر الأمن", "Security toolkit"],
  home: ["نظرة عامة", "Overview"],
  web: ["فحص أمان الويب", "Web security audit"],
  url: ["الروابط ورموز QR", "Links & QR"],
  browser: ["خصوصية المتصفح", "Browser privacy"],
  logs: ["تحليل السجلات", "Log analysis"],
  reports: ["استوديو التقارير", "Report studio"],
  webDesc: [
    "حلّل الترويسات وسياسات الحماية وDNS والتحويلات، مع دليل واضح لكل ملاحظة.",
    "Inspect security headers, cookies, DNS, and redirects with evidence for every finding."
  ],
  urlDesc: [
    "افهم الوجهة الحقيقية وبنية الرابط ومحتوى QR قبل فتحه.",
    "Understand a URL’s structure, destination, and QR content before opening it."
  ],
  browserDesc: [
    "اكتشف ما تراه صفحات الويب عن متصفحك، مع تفسير دقة كل معلومة.",
    "See what web pages can observe about your browser and how precise it is."
  ],
  logsDesc: [
    "حوّل سجلات الخادم إلى خط زمني وفلاتر ومؤشرات تستحق المراجعة.",
    "Turn server logs into a timeline, filters, and indicators worth reviewing."
  ],
  reportsDesc: [
    "اجمع الأدلة وقارن النتائج وأنشئ تقريرًا جاهزًا للمشاركة.",
    "Combine evidence, compare findings, and export a report ready to share."
  ],
  local: ["داخل جهازك", "On your device"],
  network: ["يتصل بالموقع", "Connects to target"],
  privacy: ["نتائجك تحت سيطرتك", "Your results, your control"],
  privateNote: [
    "الأدوات المحلية لا ترفع ملفاتك. فحص الويب يرسل الرابط فقط لإجراء الفحص؛ لا تُحفظ نتائجه سحابيًا.",
    "Local tools never upload your files. Live audits send the URL to perform the scan; reports are not stored in the cloud."
  ],
  heroTitle: [
    "افهم ما تراه.\nوتحقق مما يهم.",
    "See what’s exposed.\nUnderstand what matters."
  ],
  heroDesc: [
    "مساحة عمل واضحة لفحص أمان الويب وتحليل الأدلة. أدوات عملية، شروحات مفهومة، وخصوصية تبدأ من جهازك.",
    "A focused workspace for web security and evidence analysis. Practical tools, clear explanations, and privacy that starts on your device."
  ],
  start: ["ابدأ فحص الويب", "Start a web audit"],
  explore: ["استكشف الأدوات", "Explore the toolkit"],
  tools: ["أدوات المختبر", "The toolkit"],
  choose: [
    "اختر نقطة البداية المناسبة لتحليلك.",
    "Choose the right starting point for your investigation."
  ],
  open: ["افتح الأداة", "Open tool"],
  noAccount: ["دون حسابات", "No accounts"],
  fiveTools: ["خمس أدوات مترابطة", "Five connected tools"],
  twoLanguages: ["عربي · English", "Arabic · English"],
  localReports: ["حفظ محلي اختياري", "Optional local history"],
  language: ["English", "العربية"],
  theme: ["المظهر", "Theme"],
  light: ["فاتح", "Light"],
  dark: ["داكن", "Dark"],
  system: ["حسب الجهاز", "System"],
  offline: [
    "أنت دون اتصال. الأدوات المحلية متاحة بعد تحميلها.",
    "You are offline. Previously loaded local tools remain available."
  ],
  update: ["تحديث جديد متاح", "An update is available"],
  reload: ["تحديث التطبيق", "Update app"],
  install: ["تثبيت التطبيق", "Install app"],
  help: ["كيف تعمل المنصة؟", "How it works"],
  sample: ["جرّب مثالًا", "Try an example"],
  analyze: ["تحليل", "Analyze"],
  analyzing: ["جارٍ التحليل…", "Analyzing…"],
  cancel: ["إلغاء", "Cancel"],
  urlLabel: ["رابط الموقع", "Website URL"],
  live: ["فحص مباشر", "Live audit"],
  importHeaders: ["ترويسات / HAR", "Headers / HAR"],
  rawHeaders: ["ترويسات HTTP", "HTTP headers"],
  headersHint: [
    "الصق ترويسات الاستجابة أو استورد ملف HAR. تتم المعالجة محليًا.",
    "Paste response headers or import a HAR file. Processing stays on your device."
  ],
  importFile: ["استيراد ملف", "Import file"],
  harEntry: ["الاستجابة من HAR", "HAR response"],
  scanUnavailable: [
    "الفحص المباشر غير مفعّل حاليًا. يمكنك تحليل الترويسات محليًا أدناه.",
    "Live scanning is currently unavailable. You can analyze headers locally below."
  ],
  scanHint: [
    "طلب GET واحد لكل خطوة، دون تحميل الصفحة أو تشغيل برامجها. حتى خمس تحويلات.",
    "One GET request per hop, without loading the page or running scripts. Up to five redirects."
  ],
  challenge: [
    "أكمل التحقق لبدء الفحص.",
    "Complete the verification to start the audit."
  ],
  result: ["نتيجة التحليل", "Analysis results"],
  observations: ["المشاهدات", "Observations"],
  findings: ["الفحوصات والملاحظات", "Checks & findings"],
  limitations: ["حدود النتيجة", "Limitations"],
  pass: ["ناجح", "Pass"],
  warn: ["ملاحظة", "Review"],
  fail: ["يحتاج معالجة", "Needs attention"],
  na: ["غير منطبق", "Not applicable"],
  untested: ["لم يُفحص", "Not tested"],
  all: ["الكل", "All"],
  attention: ["يحتاج مراجعة", "Needs review"],
  partial: [
    "هذه نتيجة جزئية؛ راجع حدود الفحص والأجزاء التي تعذر إكمالها.",
    "This result is partial. Review its limitations and incomplete checks."
  ],
  save: ["حفظ على هذا الجهاز", "Save on this device"],
  saved: ["تم الحفظ محليًا لمدة 30 يومًا.", "Saved locally for 30 days."],
  sendStudio: ["إلى استوديو التقارير", "Open in report studio"],
  download: ["تنزيل", "Download"],
  json: ["JSON", "JSON"],
  showAll: ["عرض الكل", "Show all"],
  showLess: ["عرض أقل", "Show less"],
  evidence: ["الدليل", "Evidence"],
  fix: ["طريقة المعالجة", "Remediation"],
  examples: ["أمثلة إعداد", "Configuration examples"],
  references: ["المراجع", "References"],
  info: ["معلوماتي", "Informational"],
  low: ["منخفضة", "Low"],
  medium: ["متوسطة", "Medium"],
  high: ["مرتفعة", "High"],
  priority: ["أولوية المعالجة", "Remediation priority"],
  version: ["نسخة القواعد", "Rules version"],
  source: ["المصدر", "Source"],
  value: ["القيمة", "Value"],
  direct: ["مقروءة مباشرة", "Directly observed"],
  inferred: ["تقديرية", "Inferred"],
  unavailable: ["غير متاحة", "Unavailable"],
  secondUrl: [
    "رابط ثانٍ للمقارنة (اختياري)",
    "Second URL to compare (optional)"
  ],
  comparison: ["المقارنة", "Comparison"],
  before: ["السابق", "Before"],
  after: ["الحالي", "After"],
  qrUpload: ["قراءة صورة QR", "Read a QR image"],
  qrHint: [
    "PNG / JPEG / WebP · حتى 10 MiB · معالجة محلية",
    "PNG / JPEG / WebP · up to 10 MiB · local processing"
  ],
  qrContent: ["محتوى QR كنص", "QR content as text"],
  useQr: ["استخدام المحتوى كرابط", "Use content as URL"],
  copy: ["نسخ", "Copy"],
  copied: ["تم النسخ", "Copied"],
  openTarget: ["فتح الوجهة في نافذة جديدة", "Open destination in a new tab"],
  inspectBrowser: ["عرض معلومات متصفحي", "Inspect my browser"],
  browserHint: [
    "لن يُطلب إذن الكاميرا أو الموقع أو الميكروفون.",
    "No camera, location, or microphone permission is requested."
  ],
  dropLogs: [
    "اسحب ملف السجلات هنا أو اختر ملفًا",
    "Drop a log file here or choose a file"
  ],
  logLimit: [
    "حتى 50 MiB / 200 ألف حدث · لا يغادر الملف جهازك",
    "Up to 50 MiB / 200,000 events · your file stays on your device"
  ],
  format: ["صيغة السجلات", "Log format"],
  timezone: ["منطقة الأوقات دون إزاحة", "Time zone for offset-free timestamps"],
  mapping: ["ربط حقول JSONL", "JSONL field mapping"],
  timeField: ["حقل الوقت", "Timestamp field"],
  ipField: ["حقل العنوان", "IP field"],
  pathField: ["حقل المسار", "Path field"],
  statusField: ["حقل الحالة", "Status field"],
  eventField: ["حقل الحدث", "Event field"],
  preview: ["معاينة", "Preview"],
  progress: ["تمت القراءة", "Parsed"],
  invalidLines: ["أسطر غير صالحة", "Invalid lines"],
  timeline: ["الطلبات عبر الزمن", "Requests over time"],
  topIps: ["العناوين الأكثر تكرارًا", "Most frequent IPs"],
  topPaths: ["المسارات الأكثر تكرارًا", "Most frequent paths"],
  filter: ["تصفية الأحداث", "Filter events"],
  from: ["من (UTC)", "From (UTC)"],
  to: ["إلى (UTC)", "To (UTC)"],
  ip: ["العنوان", "IP"],
  path: ["المسار", "Path"],
  status: ["الحالة", "Status"],
  event: ["الحدث", "Event"],
  time: ["الوقت UTC", "Time UTC"],
  previous: ["السابق", "Previous"],
  next: ["التالي", "Next"],
  exportFiltered: ["تنزيل الأحداث المصفاة CSV", "Export filtered events CSV"],
  rows: ["حدث", "events"],
  cancelled: ["أُلغيت المعالجة.", "Processing cancelled."],
  sessionReports: ["تقارير الجلسة", "Session reports"],
  history: ["المحفوظة على الجهاز", "Saved on this device"],
  noReports: [
    "لا توجد تقارير بعد. حلّل مثالًا من إحدى الأدوات أو استورد تقرير JSON.",
    "No reports yet. Analyze an example in a tool or import a JSON report."
  ],
  reportTitle: ["عنوان التقرير", "Report title"],
  author: ["اسم مُعد التقرير", "Prepared by"],
  notes: ["ملاحظات التقرير", "Report notes"],
  createReport: ["تجهيز التقرير", "Prepare report"],
  selected: ["محدد", "selected"],
  importReport: ["استيراد تقارير JSON", "Import JSON reports"],
  clearHistory: ["حذف كل المحفوظات", "Clear saved history"],
  delete: ["حذف", "Delete"],
  confirmDelete: [
    "حذف التقارير المحفوظة على هذا الجهاز؟",
    "Delete reports saved on this device?"
  ],
  mask: [
    "إخفاء جزء من عناوين IP في التصدير",
    "Mask part of IP addresses in exports"
  ],
  redactPreview: [
    "معاينة النسخة المنقحة قبل التنزيل",
    "Review the redacted version before downloading"
  ],
  print: ["PDF / طباعة", "PDF / Print"],
  compareReports: ["قارن التقريرين المحددين", "Compare two selected reports"],
  rulesChanged: [
    "اختلفت نسخة القواعد. قد يعود اختلاف النتائج إلى تحديث المحرك.",
    "Rules versions differ. Changes may be due to engine updates."
  ],
  incompatible: [
    "تختلف الأداة أو الوجهة؛ تُعرض الفروق للمراجعة ولا تعني تحسنًا أو تراجعًا مباشرًا.",
    "Tool or target differs; differences are for review and do not imply a direct improvement or regression."
  ],
  added: ["فحوص جديدة", "New checks"],
  removed: ["فحوص غير موجودة حاليًا", "Checks no longer present"],
  changed: ["فحوص تغيرت", "Changed checks"],
  changedObservations: ["مشاهدات تغيرت", "Changed observations"],
  storageNote: [
    "الحفظ اختياري، حتى 100 تقرير أو 25 MiB، لمدة 30 يومًا. يحتفظ المتصفح بالبيانات وقد يحذفها؛ نزّل نسخة مهمة.",
    "Saving is optional: up to 100 reports or 25 MiB for 30 days. Browser storage can be evicted; download important copies."
  ],
  footer: [
    "أدلة واضحة. نتائج في سياقها.",
    "Clear evidence. Contextual results."
  ],
  reportHelp: [
    "اختر حتى 20 تقريرًا من الجلسة أو المحفوظات، ثم جهّز النسخة المنقحة.",
    "Select up to 20 session or saved reports, then prepare a redacted export."
  ],
  resolved: ["فحوص تحسنت", "Resolved checks"],
  regressed: ["فحوص تراجعت", "Regressed checks"]
} as const;
export type MessageKey = keyof typeof messages;
export const translate = (key: MessageKey, lang: Language) =>
  messages[key][lang === "ar" ? 0 : 1];
export const errors: Record<string, readonly [string, string]> = {
  INVALID_URL: ["صيغة الرابط غير صالحة.", "The URL is invalid."],
  BLOCKED_TARGET: [
    "هذه الوجهة أو صيغة الاتصال غير مسموحة للفحص العام.",
    "This destination or connection format is not permitted for public scanning."
  ],
  INVALID_REQUEST: [
    "راجع المدخلات وحاول مجددًا.",
    "Check the input and try again."
  ],
  INVALID_REPORT: [
    "ملف التقرير غير صالح أو نسخته غير مدعومة.",
    "The report file is invalid or its version is unsupported."
  ],
  INVALID_HAR: [
    "ملف HAR لا يحتوي استجابات صالحة.",
    "The HAR file contains no valid responses."
  ],
  FILE_TOO_LARGE: [
    "حجم الملف يتجاوز الحد المسموح.",
    "The file exceeds the allowed size."
  ],
  LINE_TOO_LARGE: [
    "يحتوي الملف سطرًا يتجاوز 64 KiB.",
    "The file contains a line exceeding 64 KiB."
  ],
  TOO_MANY_REPORTS: [
    "يمكن استيراد حتى 20 تقريرًا في المرة.",
    "Import up to 20 reports at a time."
  ],
  NO_REPORTS: ["اختر تقريرًا واحدًا على الأقل.", "Select at least one report."],
  STORAGE_FULL: [
    "امتلأ حد التقارير المحلية. احذف بعض المحفوظات أو نزّل التقرير.",
    "Local report storage is full. Delete saved reports or download this report."
  ],
  STORAGE_UNAVAILABLE: [
    "تعذر استخدام التخزين المحلي؛ يمكنك تنزيل التقرير.",
    "Local storage is unavailable; you can download the report."
  ],
  INVALID_IMAGE: [
    "اختر صورة PNG أو JPEG أو WebP حتى 10 MiB.",
    "Choose a PNG, JPEG, or WebP image up to 10 MiB."
  ],
  IMAGE_TOO_LARGE: [
    "أبعاد الصورة تتجاوز 16 مليون بكسل.",
    "The image exceeds 16 million pixels."
  ],
  QR_NOT_FOUND: [
    "لم يُعثر على QR قابل للقراءة في الصورة.",
    "No readable QR code was found in the image."
  ],
  QR_UNAVAILABLE: [
    "قراءة QR غير متاحة في هذا المتصفح.",
    "QR reading is unavailable in this browser."
  ],
  QUOTA_EXCEEDED: [
    "وصلت إلى حد الاستخدام. انتظر المدة الموضحة قبل المحاولة.",
    "The usage limit was reached. Wait for the indicated time before retrying."
  ],
  CHALLENGE_REJECTED: [
    "تعذر قبول التحقق. أعده ثم حاول مجددًا.",
    "Verification was rejected. Complete it again and retry."
  ],
  SCAN_UNAVAILABLE: [
    "خدمة الفحص غير متاحة الآن. يمكنك تحليل الترويسات محليًا.",
    "Live scanning is unavailable. You can analyze headers locally."
  ],
  LIVE_SCAN_UNAVAILABLE: [
    "الفحص المباشر غير مفعّل.",
    "Live scanning is not enabled."
  ],
  TIMEOUT: [
    "تجاوز الموقع مهلة الفحص.",
    "The target exceeded the scan timeout."
  ],
  TARGET_UNREACHABLE: [
    "تعذر الوصول إلى الموقع.",
    "The target could not be reached."
  ],
  DNS_FAILED: [
    "لم تُعثر على عناوين عامة صالحة للمضيف.",
    "No valid public addresses were found for the host."
  ],
  DNS_UNAVAILABLE: [
    "تعذر إجراء استعلام DNS.",
    "The DNS lookup was unavailable."
  ],
  ORIGIN_REJECTED: [
    "ابدأ الفحص من صفحة المنصة نفسها.",
    "Start the scan from the application page."
  ],
  RESPONSE_TOO_LARGE: [
    "ترويسات الاستجابة أكبر من الحد المسموح.",
    "Response headers exceed the allowed size."
  ],
  REDIRECT_LOOP: [
    "توجد حلقة في تحويلات الموقع.",
    "The target has a redirect loop."
  ],
  TOO_MANY_REDIRECTS: [
    "تجاوزت السلسلة خمس تحويلات.",
    "The chain exceeded five redirects."
  ],
  INVALID_LOG: [
    "تعذر قراءة السجلات بهذه الإعدادات.",
    "The log could not be parsed with these settings."
  ]
};
export function errorText(code: string, lang: Language) {
  return (errors[code] ?? [
    "تعذرت العملية. راجع المدخلات أو جرّب التنزيل بدل الحفظ.",
    "The operation failed. Check your input or try downloading instead of saving."
  ])[lang === "ar" ? 0 : 1];
}
