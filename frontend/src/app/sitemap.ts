import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

const PUBLIC_ROUTES = ["/", "/blog", "/pricing", "/testimonials"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  return PUBLIC_ROUTES.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "/" || path === "/blog" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/blog" ? 0.9 : 0.8,
  }));
}
