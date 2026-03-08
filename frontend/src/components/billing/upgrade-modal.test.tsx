import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UpgradeModal } from "./upgrade-modal";

const invalidateQueriesMock = vi.fn();
const simulateCheckoutMock = vi.fn();
const trackOpenMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

vi.mock("@/lib/billing", () => ({
  BILLING_SUBSCRIPTION_QUERY_KEY: ["/api/v1/billing/me/subscription"],
  createIdempotencyKey: () => "idem-123",
  useBillingSubscription: () => ({
    data: { plan_tier: "trial_7d", status: "active" },
  }),
  useSimulateCheckout: () => ({
    isPending: false,
    mutateAsync: simulateCheckoutMock,
  }),
  useTrackUpgradeModalOpen: () => ({
    mutate: trackOpenMock,
  }),
}));

vi.mock("@/api/generated/metrics/metrics", () => ({
  getQuotaUsageApiV1MetricsQuotasGetQueryKey: () => ["/api/v1/metrics/quotas"],
  useQuotaUsageApiV1MetricsQuotasGet: () => ({
    data: {
      data: {
        quotas: [],
      },
    },
  }),
}));

describe("UpgradeModal", () => {
  it("tracks modal open with provided source", async () => {
    render(<UpgradeModal open={true} onOpenChange={vi.fn()} source="settings" />);

    await waitFor(() => expect(trackOpenMock).toHaveBeenCalledWith({ source: "settings" }));
  });

  it("runs checkout and closes modal after unlock", async () => {
    simulateCheckoutMock.mockResolvedValueOnce({
      checkout_id: "checkout-id",
      idempotent_replay: false,
      subscription: {
        plan_tier: "pro",
        status: "active",
      },
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<UpgradeModal open={true} onOpenChange={onOpenChange} source="sidebar" />);

    await user.click(screen.getByRole("button", { name: "Confirm unlock" }));

    await waitFor(() => expect(simulateCheckoutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(2);
  });
});
