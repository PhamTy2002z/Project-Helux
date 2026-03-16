import type React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import type { OnboardingProgress } from "@/lib/onboarding";
import { OnboardingWizard } from "./onboarding-wizard";

const mutateAsyncMock = vi.fn();
const trackViewedMock = vi.fn();

vi.mock("next/link", () => {
  type LinkProps = React.PropsWithChildren<{
    href: string | { pathname?: string };
  }> &
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

  return {
    default: ({ href, children, ...props }: LinkProps) => (
      <a href={typeof href === "string" ? href : "#"} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@/lib/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/lib/onboarding")>(
    "@/lib/onboarding",
  );
  return {
    ...actual,
    useUpdateOnboardingStep: () => ({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    }),
    useTrackOnboardingStepViewed: () => ({
      mutate: trackViewedMock,
    }),
  };
});

const buildProgress = (
  useCaseValue = "",
  firstPendingStep: OnboardingProgress["first_pending_step"] = "use_case",
): OnboardingProgress => ({
  organization_id: "org-1",
  user_id: "user-1",
  completed: false,
  completion_pct: 0,
  first_pending_step: firstPendingStep,
  steps: [
    {
      key: "use_case",
      title: "Define your use case",
      status: "pending",
      completed_at: null,
      skipped_at: null,
      details: useCaseValue ? { use_case: useCaseValue } : null,
    },
    {
      key: "create_first_board",
      title: "Choose your workspace mode",
      status: "pending",
      completed_at: null,
      skipped_at: null,
      details: null,
    },
    {
      key: "run_onboarding_chat",
      title: "Set your first success outcome",
      status: "pending",
      completed_at: null,
      skipped_at: null,
      details: null,
    },
    {
      key: "invite_teammate",
      title: "Plan your collaboration timing",
      status: "pending",
      completed_at: null,
      skipped_at: null,
      details: null,
    },
  ],
});

describe("OnboardingWizard use case selection", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue(buildProgress());
    trackViewedMock.mockReset();
  });

  it("requires custom text when choosing Other and submits custom use case", async () => {
    render(<OnboardingWizard progress={buildProgress()} />);

    fireEvent.click(screen.getByRole("button", { name: /other \(custom\)/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText("Describe your use case to continue."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Your use case"), {
      target: { value: "Healthcare compliance workflow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        step: "use_case",
        action: "complete",
        details: { use_case: "Healthcare compliance workflow" },
      });
    });
  });

  it("hydrates custom value from saved onboarding details", () => {
    render(<OnboardingWizard progress={buildProgress("Biotech research ops")} />);

    expect(
      screen.getByRole("button", { name: /other \(custom\)/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Your use case")).toHaveValue(
      "Biotech research ops",
    );
  });

  it("submits non-board step answers without navigation actions", async () => {
    render(<OnboardingWizard progress={buildProgress("", "create_first_board")} />);

    fireEvent.click(screen.getByRole("radio", { name: "Solo operator" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        step: "create_first_board",
        action: "complete",
        details: { workspace_mode: "solo" },
      });
    });
    expect(screen.queryByText("Create board")).not.toBeInTheDocument();
    expect(screen.queryByText("Open boards")).not.toBeInTheDocument();
  });
});
