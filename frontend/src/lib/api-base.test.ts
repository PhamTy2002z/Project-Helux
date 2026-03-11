import { afterEach, describe, expect, it, vi } from "vitest";

import { getApiBaseUrl, resolveAutoApiBaseUrl } from "./api-base";

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns normalized explicit URL", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com///");

    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });

  it("auto-resolves from browser host when set to auto", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "auto");

    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("auto-resolves from browser host when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("forces http for localhost even when page protocol is https", () => {
    expect(resolveAutoApiBaseUrl("localhost", "https:")).toBe(
      "http://localhost:8000",
    );
  });

  it("normalizes non-routable 0.0.0.0 host to localhost", () => {
    expect(resolveAutoApiBaseUrl("0.0.0.0", "http:")).toBe(
      "http://localhost:8000",
    );
  });
});
