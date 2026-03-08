import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BoardChatSessionRead } from "@/api/generated/model";
import { BoardChatSessionList } from "./BoardChatSessionList";

const sessions: BoardChatSessionRead[] = [
  {
    id: "session-1",
    board_id: "board-1",
    title: "New chat",
    created_by: null,
    created_at: "2026-03-08T00:00:00Z",
    updated_at: "2026-03-08T00:00:00Z",
    archived_at: null,
  },
  {
    id: "session-2",
    board_id: "board-1",
    title: "Release prep",
    created_by: null,
    created_at: "2026-03-08T00:00:00Z",
    updated_at: "2026-03-08T00:01:00Z",
    archived_at: null,
  },
];

describe("BoardChatSessionList", () => {
  it("triggers select and create callbacks", () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();

    render(
      <BoardChatSessionList
        sessions={sessions}
        activeSessionId="session-1"
        canWrite
        isCreating={false}
        isMutating={false}
        onSelect={onSelect}
        onCreate={onCreate}
        onRename={async () => undefined}
        onArchiveRequest={() => undefined}
      />,
    );

    fireEvent.click(screen.getByTitle("Create new chat"));
    fireEvent.click(screen.getByRole("button", { name: "Release prep" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("session-2");
  });

  it("supports inline rename and delete", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const onArchiveRequest = vi.fn();

    render(
      <BoardChatSessionList
        sessions={sessions}
        activeSessionId="session-1"
        canWrite
        isCreating={false}
        isMutating={false}
        onSelect={() => undefined}
        onCreate={() => undefined}
        onRename={onRename}
        onArchiveRequest={onArchiveRequest}
      />,
    );

    const renameButtons = screen.getAllByLabelText("Rename");
    fireEvent.click(renameButtons[0]!);

    const input = screen.getByDisplayValue("New chat");
    fireEvent.change(input, { target: { value: "Incident bridge" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith("session-1", "Incident bridge");
    });

    const deleteButtons = screen.getAllByLabelText("Delete");
    fireEvent.click(deleteButtons.at(-1) as HTMLElement);
    expect(onArchiveRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-2" }),
    );
  });
});
