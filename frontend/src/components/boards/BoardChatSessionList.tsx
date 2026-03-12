import { memo, useState } from "react";

import { Pencil, Plus, Trash2 } from "lucide-react";

import type { BoardChatSessionRead } from "@/api/generated/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type BoardChatSessionListProps = {
  sessions: BoardChatSessionRead[];
  activeSessionId: string | null;
  layout?: "panel" | "dropdown";
  canWrite: boolean;
  isCreating: boolean;
  isMutating: boolean;
  onSelect: (chatSessionId: string) => void;
  onCreate: () => void;
  onRename: (chatSessionId: string, title: string) => Promise<void>;
  onArchiveRequest: (session: BoardChatSessionRead) => void;
};

export const BoardChatSessionList = memo(function BoardChatSessionList({
  sessions,
  activeSessionId,
  layout = "panel",
  canWrite,
  isCreating,
  isMutating,
  onSelect,
  onCreate,
  onRename,
  onArchiveRequest,
}: BoardChatSessionListProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const isDropdownLayout = layout === "dropdown";

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col",
        isDropdownLayout
          ? "max-h-[70vh]"
          : "h-full border-b border-slate-200 md:w-72 md:border-b-0 md:border-r",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Chats
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2"
          onClick={onCreate}
          disabled={!canWrite || isCreating}
          title={canWrite ? "Create new chat" : "Read-only access"}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            No chat sessions yet.
          </p>
        ) : null}
        <div className="space-y-1">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = session.id === editingSessionId;

            if (isEditing) {
              return (
                <div
                  key={session.id}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 shadow-sm"
                >
                  <Input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    autoFocus
                    className="h-8"
                    onKeyDown={async (event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingSessionId(null);
                        setTitleDraft("");
                        return;
                      }
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const nextTitle = titleDraft.trim();
                      if (!nextTitle) return;
                      await onRename(session.id, nextTitle);
                      setEditingSessionId(null);
                      setTitleDraft("");
                    }}
                  />
                  <div className="mt-2 flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        setEditingSessionId(null);
                        setTitleDraft("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2"
                      disabled={isMutating || !titleDraft.trim()}
                      onClick={async () => {
                        const nextTitle = titleDraft.trim();
                        if (!nextTitle) return;
                        await onRename(session.id, nextTitle);
                        setEditingSessionId(null);
                        setTitleDraft("");
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={session.id}
                className={cn(
                  "group flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-2 transition",
                  isActive
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                >
                  {session.title}
                </button>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 p-0 text-slate-500 hover:text-slate-700"
                    disabled={!canWrite || isMutating}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setEditingSessionId(session.id);
                      setTitleDraft(session.title);
                    }}
                    title="Rename"
                    aria-label="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    disabled={!canWrite || isMutating}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onArchiveRequest(session);
                    }}
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {!canWrite ? (
        <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
          Read-only access. Session changes are disabled.
        </div>
      ) : null}
    </div>
  );
});

BoardChatSessionList.displayName = "BoardChatSessionList";
