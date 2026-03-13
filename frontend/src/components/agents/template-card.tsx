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

interface TemplateCardProps {
  template: WorkspaceTemplateRead;
  selected: boolean;
  onSelect: () => void;
}

export function TemplateCard({ template, selected, onSelect }: TemplateCardProps) {
  const Icon = resolveIcon(template.icon);
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
        "relative flex flex-col gap-2 rounded-xl border bg-white p-4 text-left shadow-sm transition-all cursor-pointer",
        "hover:shadow-md hover:border-slate-300",
        selected
          ? "border-blue-500 ring-2 ring-blue-500 ring-offset-1"
          : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
        {template.category ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {template.category}
          </Badge>
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 leading-snug">{template.name}</p>
        {description ? (
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">{description}</p>
        ) : null}
      </div>
    </button>
  );
}
