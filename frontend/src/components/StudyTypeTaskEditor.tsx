"use client";

import { inputClass, Button } from "@/components/ui";

export interface EditableStudyTypeTask {
  tempId: string;
  taskName: string;
  description: string;
  groupName: string;
  defaultDurationDays: string;
  isFixed: boolean;
}

// Spec 6: template tasks carry a default duration, not absolute dates —
// absolute dates only exist once a task is copied into an actual STUDY.
export function StudyTypeTaskEditor({
  tasks,
  onChange,
}: {
  tasks: EditableStudyTypeTask[];
  onChange: (tasks: EditableStudyTypeTask[]) => void;
}) {
  function update(id: string, patch: Partial<EditableStudyTypeTask>) {
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
    onChange([
      ...tasks,
      {
        tempId: crypto.randomUUID(),
        taskName: "",
        description: "",
        groupName: last?.groupName ?? "",
        defaultDurationDays: "1",
        isFixed: false,
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
          <div className="grid flex-1 grid-cols-12 gap-2">
            <input
              className={`${inputClass} col-span-3`}
              placeholder="Group (optional)"
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
              className={`${inputClass} col-span-3`}
              placeholder="Description (optional)"
              value={task.description}
              onChange={(e) => update(task.tempId, { description: e.target.value })}
            />
            <input
              type="number"
              min={1}
              className={`${inputClass} col-span-2`}
              placeholder="Days"
              value={task.defaultDurationDays}
              onChange={(e) => update(task.tempId, { defaultDurationDays: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-1 pt-1.5 text-xs text-gray-500" title="Cannot be marked Not Applicable">
            <input
              type="checkbox"
              checked={task.isFixed}
              onChange={(e) => update(task.tempId, { isFixed: e.target.checked })}
            />
            Fixed
          </label>
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
