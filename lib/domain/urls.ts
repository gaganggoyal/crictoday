export const URL_SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "cutt.ly",
  "rb.gy",
  "shorturl.at",
  "tiny.cc",
  "buff.ly",
  "rebrand.ly",
]);

export function hostnameOf(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function assertHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local")) return null;
    if (URL_SHORTENERS.has(host)) return null;
    return url;
  } catch {
    return null;
  }
}

export function isDeniedDomain(host: string, deny: string[]) {
  const normalized = host.replace(/^www\./, "").toLowerCase();
  return deny.some((item) => normalized === item || normalized.endsWith(`.${item}`));
}

export function isAllowedDomain(host: string, allow: string[]) {
  const normalized = host.replace(/^www\./, "").toLowerCase();
  return allow.some((item) => normalized === item || normalized.endsWith(`.${item}`));
}
