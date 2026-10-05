import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/api/", "/go/", "/login", "/requests/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
