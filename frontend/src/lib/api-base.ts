const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const normalizeAutoHost = (host: string): string => {
  const normalized = host.trim().toLowerCase();
  if (!normalized || normalized === "0.0.0.0" || normalized === "::" || normalized === "[::]") {
    return "localhost";
  }
  return normalized;
};

export function resolveAutoApiBaseUrl(host: string, protocol: string): string {
  const normalizedHost = normalizeAutoHost(host);
  const resolvedProtocol = LOOPBACK_HOSTS.has(normalizedHost)
    ? "http"
    : protocol === "https:"
      ? "https"
      : "http";
  return `${resolvedProtocol}://${normalizedHost}:8000`;
}

export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw && raw.toLowerCase() !== "auto") {
    const normalized = raw.replace(/\/+$/, "");
    if (!normalized) {
      throw new Error("NEXT_PUBLIC_API_URL is invalid.");
    }
    return normalized;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host) {
      return resolveAutoApiBaseUrl(host, window.location.protocol);
    }
  }

  throw new Error(
    "NEXT_PUBLIC_API_URL is not set and cannot be auto-resolved outside the browser.",
  );
}
