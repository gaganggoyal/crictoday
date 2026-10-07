import type { NextConfig } from "next";

function contentSecurityPolicy() {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (process.env.NODE_ENV !== "production") scriptSrc.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co https://us.i.posthog.com https://*.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Only where the site itself is served over HTTPS, so a local production build still loads.
    ...(process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")
      ? ["upgrade-insecure-requests"]
      : []),
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Node-only drivers: load them with require at runtime instead of bundling them.
  serverExternalPackages: ["mysql2", "nodemailer", "sharp"],
  experimental: {
    // Profile pictures are sent through server actions. Browsers shrink them first; this leaves
    // room for an 8 MB original when they cannot.
    serverActions: { bodySizeLimit: "9mb" },
  },
  // The addresses people guess for the about, contact and policy pages.
  async redirects() {
    return [
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      { source: "/privacy-policy", destination: "/legal/privacy", permanent: true },
      { source: "/terms", destination: "/legal/terms", permanent: true },
      { source: "/terms-of-use", destination: "/legal/terms", permanent: true },
      { source: "/terms-and-conditions", destination: "/legal/terms", permanent: true },
      {
        source: "/legal/ticket-policy",
        destination: "/how-we-check-ticket-links",
        permanent: true,
      },
    ];
  },
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
