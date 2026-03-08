import type { NextRequest } from "next/server";

const normalizeApiBase = (value: string): string => value.replace(/\/+$/, "");

export function resolveServerApiBaseUrl(request: NextRequest): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw && raw.toLowerCase() !== "auto") {
    return normalizeApiBase(raw);
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");

  const protocol =
    forwardedProto?.split(",")[0]?.trim() ??
    request.nextUrl.protocol.replace(/:$/, "") ??
    "http";

  const host = forwardedHost?.split(",")[0]?.trim() ?? hostHeader ?? "";
  if (!host) {
    throw new Error(
      "Unable to resolve backend URL on server: NEXT_PUBLIC_API_URL is auto and host header is missing.",
    );
  }

  const hostname = host.split(":")[0];
  return `${protocol}://${hostname}:8000`;
}
