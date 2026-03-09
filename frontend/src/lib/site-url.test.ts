import { afterEach, describe, expect, it, vi } from "vitest";

import { getSiteUrl } from "./site-url";

describe("getSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("normalizes NEXT_PUBLIC_SITE_URL to origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://mc.example.com/foo/bar");

    expect(getSiteUrl()).toBe("https://mc.example.com");
  });

  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-url");

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
