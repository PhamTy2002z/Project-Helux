"use client";

import { AuthMode } from "@/auth/mode";
import { isSaasAuthProfile } from "@/auth/profile";
import { LOCAL_AUTH_STATE_COOKIE } from "@/auth/local-auth-shared";

let localSessionActive: boolean | null = null;
const SESSION_MARKER = "local-session";

export function isLocalAuthMode(): boolean {
  if (isSaasAuthProfile()) return false;
  return process.env.NEXT_PUBLIC_AUTH_MODE === AuthMode.Local;
}

const readStateCookie = (): boolean => {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${LOCAL_AUTH_STATE_COOKIE}=1`));
};

const setStateCookie = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  const securePart = window.location.protocol === "https:" ? "; Secure" : "";
  if (enabled) {
    document.cookie = `${LOCAL_AUTH_STATE_COOKIE}=1; Path=/; SameSite=Lax${securePart}`;
    return;
  }
  document.cookie = `${LOCAL_AUTH_STATE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${securePart}`;
};

export function setLocalAuthToken(_token: string): void {
  localSessionActive = true;
  setStateCookie(true);
}

export function getLocalAuthToken(): string | null {
  if (localSessionActive === true) return SESSION_MARKER;
  if (localSessionActive === false) return null;

  const hasCookieMarker = readStateCookie();
  localSessionActive = hasCookieMarker;
  return hasCookieMarker ? SESSION_MARKER : null;
}

export async function verifyLocalAuthSession(): Promise<boolean> {
  if (!isLocalAuthMode()) return false;
  if (!getLocalAuthToken()) return false;

  try {
    const response = await fetch("/api/local-auth/session", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      clearLocalAuthToken();
      return false;
    }
    const payload = (await response.json().catch(() => null)) as
      | { authenticated?: unknown }
      | null;
    const authenticated = payload?.authenticated === true;
    localSessionActive = authenticated;
    setStateCookie(authenticated);
    return authenticated;
  } catch {
    clearLocalAuthToken();
    return false;
  }
}

export async function establishLocalAuthSession(token: string): Promise<void> {
  const response = await fetch("/api/local-auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
    credentials: "same-origin",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: unknown }
      | null;
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : "Unable to persist local auth session.";
    throw new Error(detail);
  }

  setLocalAuthToken(token);
}

export async function destroyLocalAuthSession(): Promise<void> {
  try {
    await fetch("/api/local-auth/session", {
      method: "DELETE",
      credentials: "same-origin",
    });
  } finally {
    clearLocalAuthToken();
  }
}

export function clearLocalAuthToken(): void {
  localSessionActive = false;
  setStateCookie(false);
}
