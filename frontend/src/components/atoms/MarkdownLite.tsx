"use client";

import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { MarkdownVariant } from "./Markdown";

const SHORT_CONTENT_MAX_CHARS = 280;
const MENTION_PATTERN =
  /(^|[^A-Za-z0-9_])(@[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?)/g;
const HEAVY_MARKDOWN_PATTERN =
  /(^|\n)\s*(#{1,6}\s|>|\* |\+ |\d+\.\s|- |\|.+\||```|~~~|[-*_]{3,}\s*$)|\[[^\]]+\]\([^)]+\)|`|~~|^\s*[-*+]\s\[[ xX]\]/m;
const INLINE_MARKDOWN_PATTERN =
  /(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(^|[^A-Za-z0-9])\*[^*\n]+\*(?=[^A-Za-z0-9]|$)|(^|[^A-Za-z0-9])_[^_\n]+_(?=[^A-Za-z0-9]|$)/m;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>()]+/i;

const normalizeLiteContent = (
  content: string,
  variant: MarkdownVariant,
): string => {
  const trimmed = content.trim();
  if (variant !== "chat") return trimmed;
  return trimmed
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const shouldRenderMarkdownLite = (
  content: string,
  variant: MarkdownVariant,
): boolean => {
  const normalized = normalizeLiteContent(content, variant);
  if (!normalized) return true;
  if (variant === "description") return false;
  if (normalized.length > SHORT_CONTENT_MAX_CHARS) return false;
  if (HEAVY_MARKDOWN_PATTERN.test(normalized)) return false;
  if (INLINE_MARKDOWN_PATTERN.test(normalized)) return false;
  if (URL_PATTERN.test(normalized)) return false;
  if (variant === "basic" && normalized.includes("\n")) return false;
  return true;
};

const renderMentionsInText = (text: string, keyPrefix: string): ReactNode => {
  let lastIndex = 0;
  let mentionCount = 0;
  const nodes: ReactNode[] = [];

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const prefix = match[1] ?? "";
    const mention = match[2] ?? "";
    const mentionStart = matchIndex + prefix.length;

    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex));
    }

    if (prefix) {
      nodes.push(prefix);
    }

    nodes.push(
      <span
        key={`${keyPrefix}-${mentionCount}`}
        className="font-semibold text-cyan-700"
      >
        {mention}
      </span>,
    );

    lastIndex = mentionStart + mention.length;
    mentionCount += 1;
  }

  if (nodes.length === 0) {
    return text;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

export const MarkdownLite = memo(function MarkdownLite({
  content,
  variant,
}: {
  content: string;
  variant: MarkdownVariant;
}) {
  const normalized = normalizeLiteContent(content, variant);
  if (!normalized) return null;

  return (
    <p
      className={cn(
        "text-inherit break-words",
        variant === "chat" && "leading-6 whitespace-pre-line",
        variant === "comment" && "whitespace-pre-line",
        variant === "description" && "whitespace-pre-wrap",
      )}
    >
      {renderMentionsInText(normalized, `lite-${variant}`)}
    </p>
  );
});

MarkdownLite.displayName = "MarkdownLite";
