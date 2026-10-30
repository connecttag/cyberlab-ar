const sensitive =
  /token|secret|pass(word|wd)?|auth|api[-_]?key|session|jwt|code|signature|credential|access[-_]?key/i;
export function redactUrl(input: string): string {
  try {
    const u = new URL(input);
    u.username = "";
    u.password = "";
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (sensitive.test(key)) u.searchParams.set(key, "[REDACTED]");
    return u.href;
  } catch {
    return input
      .replace(
        /([?&](?:token|password|secret|key|code)=)[^&#\s]*/gi,
        "$1[REDACTED]"
      )
      .slice(0, 4096);
  }
}
export function redactText(input: string): string {
  return input
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/=._~-]+/gi, "$1 [REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED JWT]"
    )
    .replace(
      /\b(password|passwd|token|secret|api[_-]?key|authorization|cookie|session)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s&,;]+)/gi,
      "$1=[REDACTED]"
    )
    .replace(/https?:\/\/[^\s<>"']+/g, redactUrl);
}
export function maskIp(input: string): string {
  return input
    .replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}\b/g, "$1.x")
    .replace(/\b([a-f0-9]{1,4}:){3,}[a-f0-9:]+/gi, "[IPv6]");
}
export function escapeHtml(input: unknown): string {
  return String(input ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );
}
export function csvCell(input: unknown): string {
  let value = String(input ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(value)) value = "'" + value;
  return '"' + value.replace(/"/g, '""') + '"';
}
