import type { ImgHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FeatureCards from "./feature-cards";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    quality: _quality,
    unoptimized: _unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    quality?: number;
    unoptimized?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("./scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("FeatureCards", () => {
  it("renders the trusted and scalable landing posters", () => {
    render(<FeatureCards />);

    expect(
      screen.getByRole("heading", {
        name: /trusted by teams\. built for scale\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Trusted" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Scalable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(/trusted poster showing an agent workflow timeline/i),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(
        /scalable poster showing workflow growth across departments/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Workflow tracing")).toBeInTheDocument();
    expect(screen.getByText("Role-based access control")).toBeInTheDocument();
  });
});
