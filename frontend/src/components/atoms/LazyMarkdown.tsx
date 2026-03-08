"use client";

import { Suspense, lazy, memo } from "react";

import type { MarkdownVariant } from "./Markdown";
import { MarkdownLite, shouldRenderMarkdownLite } from "./MarkdownLite";

const MarkdownHeavy = lazy(async () => {
  const markdownModule = await import("./Markdown");
  return { default: markdownModule.Markdown };
});

export const LazyMarkdown = memo(function LazyMarkdown({
  content,
  variant,
}: {
  content: string;
  variant: MarkdownVariant;
}) {
  if (shouldRenderMarkdownLite(content, variant)) {
    return <MarkdownLite content={content} variant={variant} />;
  }

  return (
    <Suspense fallback={<MarkdownLite content={content} variant={variant} />}>
      <MarkdownHeavy content={content} variant={variant} />
    </Suspense>
  );
});

LazyMarkdown.displayName = "LazyMarkdown";
