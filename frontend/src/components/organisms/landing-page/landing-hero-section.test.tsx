import type { ComponentPropsWithoutRef } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LandingHeroSection from "./landing-hero-section";

const authState = vi.hoisted(() => ({ isSignedIn: false }));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: ComponentPropsWithoutRef<"a"> & {
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/auth/clerk", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: authState.isSignedIn,
  }),
}));

vi.mock("./trust-marquee", () => ({
  default: () => <div>Trust marquee</div>,
}));

describe("LandingHeroSection", () => {
  beforeEach(() => {
    authState.isSignedIn = false;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the hero heading and subtitle", () => {
    render(<LandingHeroSection />);

    expect(
      screen.getByText(/one platform to orchestrate/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/visgniteai gives your team/i)).toBeInTheDocument();
  });

  it("renders the CSS star background layers", () => {
    const { container } = render(<LandingHeroSection />);

    const starLayers = container.querySelectorAll("[class*='animate-stars-']");
    expect(starLayers).toHaveLength(3);
  });

  it("shows Start Building Free CTA for anonymous users", () => {
    render(<LandingHeroSection />);

    expect(
      screen.getByRole("link", { name: /start building free/i }),
    ).toBeInTheDocument();
  });

  it("shows Open Board CTA for signed-in users", () => {
    authState.isSignedIn = true;

    render(<LandingHeroSection />);

    expect(
      screen.getByRole("link", { name: /open board/i }),
    ).toBeInTheDocument();
  });
});
