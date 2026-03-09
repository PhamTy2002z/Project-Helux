import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCAL_AUTH_STATE_COOKIE } from "@/auth/local-auth-shared";

const setStateCookie = (enabled: boolean) => {
  if (enabled) {
    document.cookie = `${LOCAL_AUTH_STATE_COOKIE}=1; Path=/`;
    return;
  }
  document.cookie = `${LOCAL_AUTH_STATE_COOKIE}=; Path=/; Max-Age=0`;
};

const loadLocalAuth = async () =>
  import("@/auth/localAuth").then((module) => module);

describe("verifyLocalAuthSession", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "local");
    vi.stubEnv("NEXT_PUBLIC_AUTH_PROFILE", "self_hosted");
    setStateCookie(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    setStateCookie(false);
  });

  it("keeps session active when local session cookie and backend validation both pass", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setStateCookie(true);

    const auth = await loadLocalAuth();

    await expect(auth.verifyLocalAuthSession()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/local-auth/session",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/local-auth/proxy/api/v1/users/me",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
    expect(auth.getLocalAuthToken()).toBe("local-session");
  });

  it("clears local session when backend validation fails", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    setStateCookie(true);

    const auth = await loadLocalAuth();

    await expect(auth.verifyLocalAuthSession()).resolves.toBe(false);
    expect(auth.getLocalAuthToken()).toBeNull();
    expect(document.cookie).not.toContain(`${LOCAL_AUTH_STATE_COOKIE}=1`);
  });
});
