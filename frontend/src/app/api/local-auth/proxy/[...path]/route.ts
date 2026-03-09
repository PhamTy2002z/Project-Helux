import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { LOCAL_AUTH_TOKEN_COOKIE } from "@/auth/local-auth-shared";
import { resolveServerApiBaseUrl } from "@/lib/api-base-server";

const PROXY_PREFIX = "/api/local-auth/proxy";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
  "authorization",
]);

async function proxyRequest(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(LOCAL_AUTH_TOKEN_COOKIE)?.value?.trim();
  if (!token) {
    return NextResponse.json(
      { detail: "Local auth session missing." },
      { status: 401 },
    );
  }

  const path = request.nextUrl.pathname.startsWith(PROXY_PREFIX)
    ? request.nextUrl.pathname.slice(PROXY_PREFIX.length)
    : "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const targetBase = resolveServerApiBaseUrl(request);
  const targetUrl = `${targetBase}${normalizedPath}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    headers.set(key, value);
  });
  headers.set("Authorization", `Bearer ${token}`);

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "Unable to reach backend service." },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}
