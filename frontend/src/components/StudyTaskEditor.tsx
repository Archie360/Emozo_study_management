"use client";

import { inputClass, Button } from "@/components/ui";

export interface EditableTask {
  tempId: string;
  taskName: string;
  description: string;
  groupName: string;
  startDate: string;
  endDate: string;
}

// Spec 13-15: editable working list of TASKS for the "modify template" and
// "build from scratch" workflows — add / delete / rename / edit description
// / reorder / define dates. Up/down buttons stand in for drag-and-drop
// (spec 36 calls for drag-and-drop in the full UI; functionally equivalent).
export function StudyTaskEditor({
  tasks,
  onChange,
}: {
  tasks: EditableTask[];
  onChange: (tasks: EditableTask[]) => void;
}) {
  function update(id: string, patch: Partial<EditableTask>) {
    onChange(tasks.map((t) => (t.tempId === id ? { ...t, ...patch } : t)));
  }

  function remove(id: string) {
    onChange(tasks.filter((t) => t.tempId !== id));
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...tasks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addTask() {
    const last = tasks[tasks.length - 1];
    const start = last?.endDate ?? "";
    onChange([
      ...tasks,
      {
        tempId: crypto.randomUUID(),
        taskName: "",
        description: "",
        groupName: last?.groupName ?? "",
        startDate: start,
        endDate: start,
      },
    ]);
  }

  return (
    <div className="space-y-2">
      {tasks.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          No tasks yet. Add one below.
        </p>
      )}
      {tasks.map((task, index) => (
        <div key={task.tempId} className="flex items-start gap-2 rounded-md border border-gray-200 p-3">
          <div className="flex flex-col pt-1 text-gray-400">
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="disabled:opacity-30">
              ▲
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === tasks.length - 1}
              className="disabled:opacity-30"
            >
              ▼
            </button>
          </div>
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-12 gap-2">
              <input
                className={`${inputClass} col-span-2`}
                placeholder="Group"
                value={task.groupName}
                onChange={(e) => update(task.tempId, { groupName: e.target.value })}
              />
              <input
                className={`${inputClass} col-span-4`}
                placeholder="Task name"
                value={task.taskName}
                onChange={(e) => update(task.tempId, { taskName: e.target.value })}
              />
              <input
                type="date"
                className={`${inputClass} col-span-3`}
                value={task.startDate}
                onChange={(e) => update(task.tempId, { startDate: e.target.value })}
              />
              <input
                type="date"
                className={`${inputClass} col-span-3`}
                value={task.endDate}
                onChange={(e) => update(task.tempId, { endDate: e.target.value })}
              />
            </div>
            <input
              className={`${inputClass} w-full`}
              placeholder="Description (optional)"
              value={task.description}
              onChange={(e) => update(task.tempId, { description: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(task.tempId)}
            className="pt-1 text-gray-400 hover:text-red-600"
            title="Remove task"
          >
            ✕
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addTask}>
        + Add Task
      </Button>
    </div>
  );
}
