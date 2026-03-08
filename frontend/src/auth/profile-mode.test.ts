import { afterEach, describe, expect, it, vi } from "vitest";

import { isLocalAuthMode } from "@/auth/localAuth";

describe("isLocalAuthMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false for saas profile even when auth mode is local", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_PROFILE", "saas");
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "local");

    expect(isLocalAuthMode()).toBe(false);
  });

  it("returns true for self-hosted local auth mode", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_PROFILE", "self_hosted");
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "local");

    expect(isLocalAuthMode()).toBe(true);
  });
});
