import type { ComponentPropsWithoutRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LandingHeroSection from "./landing-hero-section";

const authState = vi.hoisted(() => ({ isSignedIn: false }));

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: ComponentPropsWithoutRef<"a"> & {
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

class MockIntersectionObserver {
  observe() {}

  disconnect() {}
}

function installMatchMedia({
  desktop = false,
  reducedMotion = false,
}: {
  desktop?: boolean;
  reducedMotion?: boolean;
}) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        query === "(min-width: 768px)"
          ? desktop
          : query === "(prefers-reduced-motion: reduce)"
            ? reducedMotion
            : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("LandingHeroSection", () => {
  beforeEach(() => {
    authState.isSignedIn = false;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    Object.defineProperty(window.navigator, "connection", {
      configurable: true,
      value: { saveData: false, effectiveType: "4g" },
    });
    Object.defineProperty(window.navigator, "hardwareConcurrency", {
      configurable: true,
      value: 6,
    });
    Object.defineProperty(window.navigator, "deviceMemory", {
      configurable: true,
      value: 6,
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not attach the hero video source on mobile screens", async () => {
    installMatchMedia({ desktop: false });

    const { container } = render(<LandingHeroSection />);
    const video = container.querySelector("video");

    await waitFor(() => {
      expect(video).not.toBeNull();
      expect(video?.getAttribute("src")).toBeNull();
      expect(video).toHaveAttribute("preload", "none");
    });
  });

  it("loads the hero video on desktop screens", async () => {
    installMatchMedia({ desktop: true });

    const { container } = render(<LandingHeroSection />);
    const video = container.querySelector("video");

    await waitFor(() => {
      expect(video?.getAttribute("src")).toContain("cloudfront.net");
      expect(video).toHaveAttribute("preload", "metadata");
    });
  });

  it("only enables the seamless dual-video blend on higher-end devices", async () => {
    Object.defineProperty(window.navigator, "hardwareConcurrency", {
      configurable: true,
      value: 10,
    });
    Object.defineProperty(window.navigator, "deviceMemory", {
      configurable: true,
      value: 8,
    });
    installMatchMedia({ desktop: true });

    const { container } = render(<LandingHeroSection />);

    await waitFor(() => {
      expect(container.querySelectorAll("video")).toHaveLength(2);
      expect(container.querySelectorAll("video")[1]).toHaveAttribute("preload", "metadata");
    });
  });

  it("shows Open Board CTA for signed-in users", () => {
    authState.isSignedIn = true;

    render(<LandingHeroSection />);

    expect(screen.getByRole("link", { name: /open board/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /request a demo/i })).not.toBeInTheDocument();
  });
});
