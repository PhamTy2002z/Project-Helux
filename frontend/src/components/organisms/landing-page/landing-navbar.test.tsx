import type { ComponentPropsWithoutRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LandingNavbar from "./landing-navbar";

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: ComponentPropsWithoutRef<"a"> & {
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/organisms/landing-slideshow/logo", () => ({
  default: () => <span>OpenClaw</span>,
}));

vi.mock("lucide-react", () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <svg className={className} aria-hidden="true" />
  ),
  Menu: ({ size: _size }: { size?: number }) => <svg aria-hidden="true" />,
  X: ({ size: _size }: { size?: number }) => <svg aria-hidden="true" />,
}));

describe("LandingNavbar", () => {
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
});
