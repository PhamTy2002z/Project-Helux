import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/mutator";
import { getApiErrorCode, getUpgradeReasonFromError } from "@/lib/billing";

describe("billing error helpers", () => {
  it("extracts quota_exceeded code and builds a quota-specific upgrade reason", () => {
    const error = new ApiError(429, "agents_per_board quota exceeded", {
      detail: {
        code: "quota_exceeded",
        resource: "agents_per_board",
        used: 3,
        limit: 3,
      },
    });

    expect(getApiErrorCode(error)).toBe("quota_exceeded");
    expect(getUpgradeReasonFromError(error, "fallback")).toContain(
      "agents per board",
    );
    expect(getUpgradeReasonFromError(error, "fallback")).toContain("(3/3)");
  });

  it("builds blocked-for-payment upgrade reason from API detail", () => {
    const error = new ApiError(402, "Trial period has ended", {
      detail: {
        code: "blocked_for_payment",
      },
    });

    expect(getApiErrorCode(error)).toBe("blocked_for_payment");
    expect(getUpgradeReasonFromError(error, "fallback")).toContain(
      "Runtime actions are blocked until upgrade",
    );
  });

  it("falls back when error detail is missing or unrelated", () => {
    const error = new ApiError(500, "Request failed", {
      detail: {
        code: "internal_error",
      },
    });

    expect(getUpgradeReasonFromError(error, "fallback reason")).toBe(
      "fallback reason",
    );
  });
});
