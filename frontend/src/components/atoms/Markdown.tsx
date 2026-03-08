"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  memo,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type MarkdownCodeProps = HTMLAttributes<HTMLElement> & {
  node?: unknown;
  inline?: boolean;
};

type StructuredSummaryEntry = {
  label: string;
  status: string | null;
  meta: string[];
};

type StructuredSummary = {
  heading: string;
  entries: StructuredSummaryEntry[];
};

const MENTION_PATTERN =
  /(^|[^A-Za-z0-9_])(@[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?)/g;
const STRUCTURED_SUMMARY_PATTERN = /^([^:\n]{2,120}):\s*(.+)$/;
const KNOWN_STATUS_VALUES = new Set([
  "online",
  "offline",
  "busy",
  "idle",
  "away",
  "active",
  "inactive",
  "healthy",
  "degraded",
  "error",
]);

const trimTrailingPunctuation = (value: string): string =>
  value.trim().replace(/[.。]+$/, "").trim();

const splitTopLevelCommas = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") {
      depth += 1;
      continue;
    }
    if (character === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (character === "," && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
};

const extractText = (content: ReactNode): string | null => {
  if (typeof content === "string") return content;
  if (typeof content === "number") return String(content);
  if (
    content === null ||
    content === undefined ||
    typeof content === "boolean"
  ) {
    return "";
  }
  if (Array.isArray(content)) {
    let text = "";
    for (const child of content) {
      const childText = extractText(child);
      if (childText === null) return null;
      text += childText;
    }
    return text;
  }
  if (isValidElement(content)) {
    const childProps = content.props as { children?: ReactNode };
    if (childProps.children === undefined) return "";
    return extractText(childProps.children);
  }
  return null;
};

const parseStructuredSummary = (text: string): StructuredSummary | null => {
  const cleanedText = trimTrailingPunctuation(text);
  const match = cleanedText.match(STRUCTURED_SUMMARY_PATTERN);
  if (!match) return null;

  const heading = trimTrailingPunctuation(match[1] ?? "");
  const entriesRaw = trimTrailingPunctuation(match[2] ?? "");
  if (!heading || !entriesRaw) return null;

  const rawEntries = splitTopLevelCommas(entriesRaw)
    .map(entry => trimTrailingPunctuation(entry))
    .filter(Boolean);
  const entries = rawEntries
    .map((entry) => {
      const detailsMatch = entry.match(/^(.+?)\s*\((.+)\)$/);
      if (!detailsMatch) return null;

      const label = detailsMatch[1]?.trim() ?? "";
      const details = splitTopLevelCommas(detailsMatch[2] ?? "")
        .map(part => trimTrailingPunctuation(part))
        .filter(Boolean);
      if (!label || details.length === 0) return null;

      const firstDetail = details[0] ?? "";
      const normalizedFirst = firstDetail.trim().toLowerCase();
      const hasStatus = KNOWN_STATUS_VALUES.has(normalizedFirst);

      return {
        label,
        status: hasStatus ? firstDetail : null,
        meta: hasStatus ? details.slice(1) : details,
      };
    })
    .filter((entry): entry is StructuredSummaryEntry => entry !== null);

  if (rawEntries.length < 2 || rawEntries.length !== entries.length) return null;
  return { heading, entries };
};

const summaryStatusTone = (status: string): string => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "online") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized === "offline") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
};

const renderStructuredSummary = (summary: StructuredSummary): ReactNode => (
  <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 last:mb-0">
    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {summary.heading}
    </p>
    <ul className="space-y-1">
      {summary.entries.map((entry) => (
        <li
          key={`${entry.label}-${entry.status ?? "na"}-${entry.meta.join("|")}`}
          className="flex flex-wrap items-center gap-1.5"
        >
          <span className="font-semibold text-slate-800">{entry.label}</span>
          {entry.status ? (
            <span
              className={cn(
                "inline-flex rounded-full border px-1.5 py-0.5 text-[11px] font-medium",
                summaryStatusTone(entry.status),
              )}
            >
              {entry.status}
            </span>
          ) : null}
          {entry.meta.map((meta) => (
            <span
              key={`${entry.label}-${meta}`}
              className={cn(
                "text-slate-600",
                meta.toLowerCase().startsWith("last seen ") && "text-slate-500",
              )}
            >
              {meta}
            </span>
          ))}
        </li>
      ))}
    </ul>
  </div>
);

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

const renderMentions = (
  content: ReactNode,
  keyPrefix = "mention",
): ReactNode => {
  if (typeof content === "string") {
    return renderMentionsInText(content, keyPrefix);
  }
  if (
    content === null ||
    content === undefined ||
    typeof content === "boolean" ||
    typeof content === "number"
  ) {
    return content;
  }
  if (Array.isArray(content)) {
    return Children.map(content, (child, index) =>
      renderMentions(child, `${keyPrefix}-${index}`),
    );
  }
  if (isValidElement(content)) {
    if (typeof content.type === "string" && content.type === "code") {
      return content;
    }
    const childProps = content.props as { children?: ReactNode };
    if (childProps.children === undefined) {
      return content;
    }
    return cloneElement(
      content as ReactElement<{ children?: ReactNode }>,
      undefined,
      renderMentions(childProps.children, keyPrefix),
    );
  }
  return content;
};

const MARKDOWN_CODE_COMPONENTS: Components = {
  pre: ({ node: _node, className, ...props }) => (
    <pre
      className={cn(
        "my-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-100",
        className,
      )}
      {...props}
    />
  ),
  code: (rawProps) => {
    // react-markdown passes `inline`, but the public `Components` typing doesn't
    // currently include it, so we pluck it safely here without leaking it to DOM.
    const {
      node: _node,
      inline,
      className,
      children,
      ...props
    } = rawProps as MarkdownCodeProps;
    const codeText = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    const isInline =
      typeof inline === "boolean" ? inline : !codeText.includes("\n");

    if (isInline) {
      return (
        <code
          className={cn(
            "rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-900",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    }

    // For fenced blocks, the parent <pre> handles the box styling.
    return (
      <code className={cn("font-mono", className)} {...props}>
        {children}
      </code>
    );
  },
};

const MARKDOWN_TABLE_COMPONENTS: Components = {
  table: ({ node: _node, className, ...props }) => (
    <div className="my-3 overflow-x-auto">
      <table className={cn("w-full border-collapse", className)} {...props} />
    </div>
  ),
  thead: ({ node: _node, className, ...props }) => (
    <thead className={cn("bg-slate-50", className)} {...props} />
  ),
  tbody: ({ node: _node, className, ...props }) => (
    <tbody className={cn("divide-y divide-slate-100", className)} {...props} />
  ),
  tr: ({ node: _node, className, ...props }) => (
    <tr className={cn("align-top", className)} {...props} />
  ),
  th: ({ node: _node, className, children, ...props }) => (
    <th
      className={cn(
        "border border-slate-200 px-3 py-2 text-left text-xs font-semibold",
        className,
      )}
      {...props}
    >
      {renderMentions(children)}
    </th>
  ),
  td: ({ node: _node, className, children, ...props }) => (
    <td
      className={cn("border border-slate-200 px-3 py-2 align-top", className)}
      {...props}
    >
      {renderMentions(children)}
    </td>
  ),
};

const MARKDOWN_COMPONENTS_BASIC: Components = {
  ...MARKDOWN_TABLE_COMPONENTS,
  ...MARKDOWN_CODE_COMPONENTS,
  a: ({ node: _node, className, children, ...props }) => (
    <a
      className={cn(
        "font-medium text-sky-700 underline decoration-sky-400 underline-offset-2 transition-colors hover:text-sky-800 hover:decoration-sky-600",
        className,
      )}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {renderMentions(children)}
    </a>
  ),
  p: ({ node: _node, className, children, ...props }) => (
    <p className={cn("mb-2 last:mb-0", className)} {...props}>
      {renderMentions(children)}
    </p>
  ),
  ul: ({ node: _node, className, ...props }) => (
    <ul className={cn("mb-2 list-disc pl-5", className)} {...props} />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol className={cn("mb-2 list-decimal pl-5", className)} {...props} />
  ),
  li: ({ node: _node, className, children, ...props }) => (
    <li className={cn("mb-1", className)} {...props}>
      {renderMentions(children)}
    </li>
  ),
  strong: ({ node: _node, className, children, ...props }) => (
    <strong className={cn("font-semibold", className)} {...props}>
      {renderMentions(children)}
    </strong>
  ),
};

const MARKDOWN_COMPONENTS_DESCRIPTION: Components = {
  ...MARKDOWN_COMPONENTS_BASIC,
  p: ({ node: _node, className, children, ...props }) => (
    <p className={cn("mb-3 last:mb-0", className)} {...props}>
      {renderMentions(children)}
    </p>
  ),
  h1: ({ node: _node, className, children, ...props }) => (
    <h1 className={cn("mb-2 text-base font-semibold", className)} {...props}>
      {renderMentions(children)}
    </h1>
  ),
  h2: ({ node: _node, className, children, ...props }) => (
    <h2 className={cn("mb-2 text-sm font-semibold", className)} {...props}>
      {renderMentions(children)}
    </h2>
  ),
  h3: ({ node: _node, className, children, ...props }) => (
    <h3 className={cn("mb-2 text-sm font-semibold", className)} {...props}>
      {renderMentions(children)}
    </h3>
  ),
};

const MARKDOWN_COMPONENTS_CHAT: Components = {
  ...MARKDOWN_COMPONENTS_BASIC,
  p: ({ node: _node, className, children, ...props }) => {
    const rawText = extractText(children);
    const summary =
      typeof rawText === "string" ? parseStructuredSummary(rawText) : null;
    if (summary) {
      return renderStructuredSummary(summary);
    }
    return (
      <p className={cn("mb-2 leading-6 last:mb-0", className)} {...props}>
        {renderMentions(children)}
      </p>
    );
  },
  h1: ({ node: _node, className, children, ...props }) => (
    <h1 className={cn("mb-2 mt-1 text-base font-semibold", className)} {...props}>
      {renderMentions(children)}
    </h1>
  ),
  h2: ({ node: _node, className, children, ...props }) => (
    <h2 className={cn("mb-2 mt-1 text-sm font-semibold", className)} {...props}>
      {renderMentions(children)}
    </h2>
  ),
  h3: ({ node: _node, className, children, ...props }) => (
    <h3 className={cn("mb-2 mt-1 text-sm font-semibold", className)} {...props}>
      {renderMentions(children)}
    </h3>
  ),
  blockquote: ({ node: _node, className, children, ...props }) => (
    <blockquote
      className={cn(
        "mb-2 border-l-2 border-slate-300 bg-slate-50/70 py-1 pl-3 text-slate-700 last:mb-0",
        className,
      )}
      {...props}
    >
      {renderMentions(children)}
    </blockquote>
  ),
  hr: ({ node: _node, className, ...props }) => (
    <hr className={cn("my-3 border-slate-200", className)} {...props} />
  ),
  input: ({ node: _node, className, ...props }) => (
    <input
      className={cn(
        "mr-2 mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-slate-700",
        className,
      )}
      {...props}
    />
  ),
};

const MARKDOWN_REMARK_PLUGINS_BASIC = [remarkGfm];
const MARKDOWN_REMARK_PLUGINS_WITH_BREAKS = [remarkGfm, remarkBreaks];

const normalizeChatContent = (content: string): string => {
  return content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export type MarkdownVariant = "basic" | "chat" | "comment" | "description";

export const Markdown = memo(function Markdown({
  content,
  variant,
}: {
  content: string;
  variant: MarkdownVariant;
}) {
  const trimmed =
    variant === "chat" ? normalizeChatContent(content) : content.trim();
  const remarkPlugins =
    variant === "comment" || variant === "chat"
      ? MARKDOWN_REMARK_PLUGINS_WITH_BREAKS
      : MARKDOWN_REMARK_PLUGINS_BASIC;
  const components = (() => {
    if (variant === "description") return MARKDOWN_COMPONENTS_DESCRIPTION;
    if (variant === "chat") return MARKDOWN_COMPONENTS_CHAT;
    return MARKDOWN_COMPONENTS_BASIC;
  })();
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {trimmed}
    </ReactMarkdown>
  );
});

Markdown.displayName = "Markdown";
