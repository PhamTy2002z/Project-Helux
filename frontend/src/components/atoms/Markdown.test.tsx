import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "./Markdown";
import { MarkdownLite, shouldRenderMarkdownLite } from "./MarkdownLite";

describe("Markdown", () => {
  it("renders single-line breaks for chat variant", () => {
    const { container } = render(
      <Markdown content={"Line one\nLine two"} variant="chat" />,
    );

    expect(container).toHaveTextContent("Line one");
    expect(container).toHaveTextContent("Line two");
    expect(container.querySelector("br")).toBeInTheDocument();
  });

  it("does not force single-line breaks for basic variant", () => {
    const { container } = render(
      <Markdown content={"Line one\nLine two"} variant="basic" />,
    );

    expect(container.querySelector("br")).toBeNull();
  });

  it("applies chat styles for headings and blockquotes", () => {
    render(
      <Markdown
        content={"### Rules update\n\n> Done requires approval"}
        variant="chat"
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 3,
      name: "Rules update",
    });
    expect(heading).toHaveClass("text-sm");

    const quoteText = screen.getByText("Done requires approval");
    expect(quoteText.closest("blockquote")).toHaveClass("border-l-2");
  });

  it("formats agent status summary lines into a compact status card", () => {
    render(
      <Markdown
        content={
          "Agents on SCMS: Maekar (online, BA, last seen 07:29:55 ICT), Visanya (offline, BA, last seen 05:08:18 ICT), Noah (online, Board Lead, last seen 07:34:37 ICT)."
        }
        variant="chat"
      />,
    );

    expect(screen.getByText("Agents on SCMS")).toBeInTheDocument();
    expect(screen.getByText("Maekar")).toBeInTheDocument();
    expect(screen.getByText("Visanya")).toBeInTheDocument();
    expect(screen.getByText("Noah")).toBeInTheDocument();
    expect(screen.getAllByText("online")).toHaveLength(2);
    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(screen.getByText("Board Lead")).toBeInTheDocument();
    expect(screen.getByText("last seen 07:34:37 ICT")).toBeInTheDocument();
  });

  it("formats structured summary lines for chat messages consistently", () => {
    render(
      <Markdown
        content={
          "Review status: API (busy, in progress), UI (idle, waiting review), QA (active, blocked by fixtures)."
        }
        variant="chat"
      />,
    );

    expect(screen.getByText("Review status")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText("UI")).toBeInTheDocument();
    expect(screen.getByText("QA")).toBeInTheDocument();
    expect(screen.getByText("busy")).toBeInTheDocument();
    expect(screen.getByText("blocked by fixtures")).toBeInTheDocument();
  });

  it("normalizes noisy chat spacing before rendering", () => {
    const { container } = render(
      <Markdown content={"Line one   \n\n\nLine two"} variant="chat" />,
    );

    expect(container).toHaveTextContent("Line one");
    expect(container).toHaveTextContent("Line two");
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("highlights mentions in markdown lite chat rendering", () => {
    const { container } = render(
      <MarkdownLite content="@lead Check task status" variant="chat" />,
    );

    const mention = screen.getByText("@lead");
    expect(mention).toHaveClass("text-cyan-700");
    expect(container).toHaveTextContent("Check task status");
  });

  it("falls back to full markdown renderer for inline emphasis tokens", () => {
    expect(shouldRenderMarkdownLite("BTC **70,445 USD**", "chat")).toBe(false);
    expect(
      shouldRenderMarkdownLite("Use *active* profile before deploy", "chat"),
    ).toBe(false);
  });

  it("falls back to full markdown renderer for urls, plus-lists, and separators", () => {
    expect(
      shouldRenderMarkdownLite("Check https://api.visgnite.com now", "chat"),
    ).toBe(false);
    expect(shouldRenderMarkdownLite("+ first item", "chat")).toBe(false);
    expect(shouldRenderMarkdownLite("---", "chat")).toBe(false);
  });

  it("keeps lite renderer for plain snake_case text", () => {
    expect(
      shouldRenderMarkdownLite("auth_token rotation is required", "chat"),
    ).toBe(true);
  });
});
