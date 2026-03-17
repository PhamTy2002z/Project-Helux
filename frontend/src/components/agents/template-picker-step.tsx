"use client";

import { useMemo, useState } from "react";

import { useListWorkspaceTemplatesApiV1WorkspaceTemplatesGet } from "@/api/generated/workspace-templates/workspace-templates";
import type { WorkspaceTemplateRead } from "@/api/generated/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TemplateCard } from "@/components/agents/template-card";

interface TemplatePickerStepProps {
  onSelect: (template: WorkspaceTemplateRead) => void;
  onSkip: () => void;
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export function TemplatePickerStep({
  onSelect,
  onSkip,
}: TemplatePickerStepProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } =
    useListWorkspaceTemplatesApiV1WorkspaceTemplatesGet();

  const templates: WorkspaceTemplateRead[] = useMemo(() => {
    if (!data || data.status !== 200) return [];
    return data.data;
  }, [data]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const t of templates) {
      if (t.category) cats.add(t.category);
    }
    return Array.from(cats).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter((t) => {
      const matchesSearch = !q || t.name.toLowerCase().includes(q);
      const matchesTab = activeTab === "all" || t.category === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [templates, search, activeTab]);

  const handleConfirm = () => {
    const found = templates.find((t) => t.id === selected);
    if (found) onSelect(found);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="outline" type="button" onClick={onSkip}>
          Skip template
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <SkeletonGrid />
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No templates found.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  selected={selected === template.id}
                  onSelect={() => setSelected(template.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selected ? (
        <div className="flex justify-end">
          <Button type="button" onClick={handleConfirm}>
            Use this template
          </Button>
        </div>
      ) : null}
    </div>
  );
}
