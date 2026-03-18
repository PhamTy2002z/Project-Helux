import type { ComponentPropsWithoutRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LandingNavbar from "./landing-navbar";

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/organisms/landing-slideshow/logo", () => ({
  default: () => <span>VisgniteAI</span>,
}));

vi.mock("lucide-react", () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <svg className={className} aria-hidden="true" />
  ),
  Menu: ({ size: _size }: { size?: number }) => <svg aria-hidden="true" />,
  X: ({ size: _size }: { size?: number }) => <svg aria-hidden="true" />,
}));

describe("LandingNavbar", () => {
  beforeEach(() => {
    authState.isSignedIn = false;
  });

  afterEach(() => {
    document.body.style.removeProperty("overflow");
  });

  it("locks body scroll while the mobile drawer is open", () => {
    render(<LandingNavbar />);

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: /close menu/i }));
    expect(document.body.style.overflow).toBe("");
  });

  it("shows Open Board instead of auth CTAs for signed-in users", () => {
    authState.isSignedIn = true;

    render(<LandingNavbar />);

    expect(
      screen.getByRole("link", { name: "Open Board" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Sign up" }),
    ).not.toBeInTheDocument();
  });

  it("routes Start Building Free CTA to sign-in for signed-out users", () => {
    render(<LandingNavbar />);

    expect(
      screen.getByRole("link", { name: "Start Building Free" }),
    ).toHaveAttribute("href", "/sign-in");
  });
});
