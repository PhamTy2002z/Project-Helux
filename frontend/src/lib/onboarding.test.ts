import { describe, expect, it } from "vitest";

import { isOnboardingComplete } from "@/lib/onboarding";

describe("isOnboardingComplete", () => {
  it("returns false when progress is missing", () => {
    expect(isOnboardingComplete(null)).toBe(false);
    expect(isOnboardingComplete(undefined)).toBe(false);
  });

  it("returns false when completed is false", () => {
    expect(
      isOnboardingComplete({
        organization_id: "org",
        user_id: "user",
        completed: false,
        completion_pct: 75,
        first_pending_step: "invite_teammate",
        steps: [],
      }),
    ).toBe(false);
  });

  it("returns true when completed is true", () => {
    expect(
      isOnboardingComplete({
        organization_id: "org",
        user_id: "user",
        completed: true,
        completion_pct: 100,
        first_pending_step: null,
        steps: [],
      }),
    ).toBe(true);
  });
});
