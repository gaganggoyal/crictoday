import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

const NEXT_PATH_ORIGIN = "http://next-path.invalid";

/** A same-origin path to send someone to after sign-in, or /dashboard. */
export function safeNextPath(value: string | null | undefined) {
  // Browsers strip tabs and newlines from a Location header, so "/\t/evil.com" becomes
  // "//evil.com". Control characters also make the redirect response itself throw.
  if (!value || !value.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return "/dashboard";
  }
  try {
    const url = new URL(value, NEXT_PATH_ORIGIN);
    if (url.origin !== NEXT_PATH_ORIGIN) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}
