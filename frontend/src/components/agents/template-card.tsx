"use client";

import {
  FileText,
  Bot,
  Zap,
  Globe,
  Code,
  BarChart,
  Mail,
  Shield,
  Database,
  Search,
  MessageSquare,
  Calendar,
  Users,
  Settings,
  Sparkles,
  Headphones,
  Pencil,
  BookOpen,
  Briefcase,
  Smile,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkspaceTemplateRead } from "@/api/generated/model";

const ICON_MAP: Record<string, LucideIcon> = {
  bot: Bot,
  zap: Zap,
  globe: Globe,
  code: Code,
  chart: BarChart,
  "bar-chart": BarChart,
  mail: Mail,
  shield: Shield,
  database: Database,
  search: Search,
  message: MessageSquare,
  "message-square": MessageSquare,
  calendar: Calendar,
  users: Users,
  settings: Settings,
  file: FileText,
  "file-text": FileText,
  sparkles: Sparkles,
  headset: Headphones,
  headphones: Headphones,
  pencil: Pencil,
  "book-open": BookOpen,
  briefcase: Briefcase,
  smile: Smile,
  "check-circle": CheckCircle,
};

function resolveIcon(iconStr: string | null | undefined): LucideIcon {
  if (!iconStr) return FileText;
  const key = iconStr.toLowerCase();
  return ICON_MAP[key] ?? FileText;
}

function TemplateIcon({ iconStr }: { iconStr: string | null | undefined }) {
  const Icon = resolveIcon(iconStr);
  // eslint-disable-next-line -- dynamic icon from map lookup requires component variable
  return <Icon className="h-5 w-5 text-[color:var(--text-muted)]" />;
}

interface TemplateCardProps {
  template: WorkspaceTemplateRead;
  selected: boolean;
  onSelect: () => void;
}

export function TemplateCard({
  template,
  selected,
  onSelect,
}: TemplateCardProps) {
  const description = template.description
    ? template.description.length > 80
      ? template.description.slice(0, 77) + "..."
      : template.description
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border bg-[color:var(--surface)] p-4 text-left shadow-sm transition-all cursor-pointer",
        "hover:shadow-md hover:border-[color:var(--border-strong)]",
        selected
          ? "border-blue-500 ring-2 ring-blue-500 ring-offset-1"
          : "border-[color:var(--border)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--surface-muted)]">
          <TemplateIcon iconStr={template.icon} />
        </div>
        {template.category ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {template.category}
          </Badge>
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold text-strong leading-snug">
          {template.name}
        </p>
        {description ? (
          <p className="mt-1 text-xs text-muted leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
    </button>
  );
}
