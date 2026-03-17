import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { defaultBoardQueryState } from "@/lib/boards/board-query-state";

import { TaskBoard } from "./TaskBoard";

type Task = ComponentProps<typeof TaskBoard>["tasks"][number];

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(16).slice(2)}`,
  title: "Task",
  status: "inbox",
  priority: "medium",
  approvals_pending_count: 0,
  blocked_by_task_ids: [],
  is_blocked: false,
  ...overrides,
});

function OverlayHarness({ tasks }: { tasks: Task[] }) {
  const [state, setState] = useState(defaultBoardQueryState);
  return (
    <TaskBoard
      tasks={tasks}
      overlayEnabled
      queryState={state}
      onQueryStateChange={setState}
    />
  );
}

describe("TaskBoard overlay", () => {
  it("renders overlay controls and groups tasks by task_group_id", () => {
    render(
      <OverlayHarness
        tasks={[
          buildTask({ id: "t1", title: "Alpha", task_group_id: "group-alpha" }),
          buildTask({ id: "t2", title: "Beta", task_group_id: "group-beta" }),
        ]}
      />,
    );

    expect(screen.getByTestId("task-board-overlay")).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search tasks/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Group group-al")).toBeInTheDocument();
    expect(screen.getByText("Group group-be")).toBeInTheDocument();
  });

  it("can collapse and expand all task groups", () => {
    render(
      <OverlayHarness
        tasks={[
          buildTask({ id: "t1", title: "Alpha", task_group_id: "group-alpha" }),
          buildTask({ id: "t2", title: "Beta", task_group_id: "group-beta" }),
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Collapse All Groups/i }),
    );
    expect(screen.getAllByText("Expand").length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: /Expand All Groups/i }));
    expect(
      screen.getAllByRole("button", { name: /^Collapse$/ }).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("applies status filter from overlay filter bar", () => {
    render(
      <OverlayHarness
        tasks={[
          buildTask({ id: "review", title: "Needs Review", status: "review" }),
          buildTask({ id: "done", title: "Completed", status: "done" }),
        ]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: /status filter/i }), {
      target: { value: "review" },
    });

    expect(screen.getByText("Needs Review")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });
});
