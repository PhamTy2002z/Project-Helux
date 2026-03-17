import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  LOCAL_AUTH_STATE_COOKIE,
  LOCAL_AUTH_TOKEN_COOKIE,
  LOCAL_AUTH_TOKEN_MIN_LENGTH,
} from "@/auth/local-auth-shared";

const isSecureCookie = process.env.NODE_ENV === "production";

const tokenCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isSecureCookie,
  path: "/",
};

const stateCookieOptions = {
  httpOnly: false,
  sameSite: "lax" as const,
  secure: isSecureCookie,
  path: "/",
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(LOCAL_AUTH_TOKEN_COOKIE)?.value;

  return NextResponse.json({ authenticated: Boolean(token?.trim()) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!token || token.length < LOCAL_AUTH_TOKEN_MIN_LENGTH) {
    return NextResponse.json(
      {
        detail: `Token must be at least ${LOCAL_AUTH_TOKEN_MIN_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_AUTH_TOKEN_COOKIE, token, tokenCookieOptions);
  response.cookies.set(LOCAL_AUTH_STATE_COOKIE, "1", stateCookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_AUTH_TOKEN_COOKIE, "", {
    ...tokenCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(LOCAL_AUTH_STATE_COOKIE, "", {
    ...stateCookieOptions,
    maxAge: 0,
  });
  return response;
}
