const FALLBACK_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return FALLBACK_SITE_URL;
  try {
    return new URL(configured).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export function getSiteOrigin(): URL {
  return new URL(getSiteUrl());
}
