const DEFAULT_SIGN_IN_REDIRECT = "/dashboard";

function isSafeRelativePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

export function resolveSignInRedirectUrl(rawRedirect: string | null): string {
  const fallback =
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL ??
    DEFAULT_SIGN_IN_REDIRECT;

  if (!rawRedirect) return fallback;

  if (isSafeRelativePath(rawRedirect)) {
    return rawRedirect === "/" ? fallback : rawRedirect;
  }

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const parsed = new URL(rawRedirect, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return fallback;
    }
    const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return normalizedPath === "/" ? fallback : normalizedPath;
  } catch {
    return fallback;
  }
}
