"use client";

import { useState } from "react";
import { inputClass, Button } from "@/components/ui";

export interface EditableTask {
  tempId: string;
  taskName: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface EditableTaskGroup {
  groupId: string;
  groupName: string;
  tasks: EditableTask[];
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
      {children}
    </label>
  );
}

// Spec 13-15: editable working list of TASKS for the "modify template" and
// "build from scratch" workflows — add / delete / rename / edit description
// / reorder (drag, or the up/down fallback) / define dates, grouped under
// draggable group blocks rather than a per-task group field.
export function StudyTaskEditor({
  groups,
  onChange,
}: {
  groups: EditableTaskGroup[];
  onChange: (groups: EditableTaskGroup[]) => void;
}) {
  const [dragGroupIndex, setDragGroupIndex] = useState<number | null>(null);
  const [dragTask, setDragTask] = useState<{ groupIndex: number; taskIndex: number } | null>(null);

  function updateGroup(groupIndex: number, patch: Partial<EditableTaskGroup>) {
    onChange(groups.map((g, i) => (i === groupIndex ? { ...g, ...patch } : g)));
  }

  function updateTask(groupIndex: number, taskIndex: number, patch: Partial<EditableTask>) {
    onChange(
      groups.map((g, i) =>
        i === groupIndex
          ? { ...g, tasks: g.tasks.map((t, j) => (j === taskIndex ? { ...t, ...patch } : t)) }
          : g
      )
    );
  }

  function removeTask(groupIndex: number, taskIndex: number) {
    onChange(
      groups.map((g, i) => (i === groupIndex ? { ...g, tasks: g.tasks.filter((_, j) => j !== taskIndex) } : g))
    );
  }

  function moveTask(groupIndex: number, taskIndex: number, direction: -1 | 1) {
    const group = groups[groupIndex];
    const target = taskIndex + direction;
    if (target < 0 || target >= group.tasks.length) return;
    const next = [...group.tasks];
    [next[taskIndex], next[target]] = [next[target], next[taskIndex]];
    updateGroup(groupIndex, { tasks: next });
  }

  function reorderTask(fromGroupIndex: number, fromTaskIndex: number, toGroupIndex: number, toTaskIndex: number) {
    if (fromGroupIndex !== toGroupIndex) return;
    const group = groups[fromGroupIndex];
    const next = [...group.tasks];
    const [moved] = next.splice(fromTaskIndex, 1);
    next.splice(toTaskIndex, 0, moved);
    updateGroup(fromGroupIndex, { tasks: next });
  }

  function addTask(groupIndex: number) {
    const group = groups[groupIndex];
    const last = group.tasks[group.tasks.length - 1];
    const start = last?.endDate ?? "";
    updateGroup(groupIndex, {
      tasks: [
        ...group.tasks,
        { tempId: crypto.randomUUID(), taskName: "", description: "", startDate: start, endDate: start },
      ],
    });
  }

  function addGroup() {
    onChange([...groups, { groupId: crypto.randomUUID(), groupName: "", tasks: [] }]);
  }

  function removeGroup(groupIndex: number) {
    onChange(groups.filter((_, i) => i !== groupIndex));
  }

  function moveGroup(groupIndex: number, direction: -1 | 1) {
    const target = groupIndex + direction;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[groupIndex], next[target]] = [next[target], next[groupIndex]];
    onChange(next);
  }

  function reorderGroup(fromIndex: number, toIndex: number) {
    const next = [...groups];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={addGroup}>
          + Add Group
        </Button>
      </div>

      {groups.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          No groups yet. Add one above.
        </p>
      )}

      {groups.map((group, groupIndex) => (
        <div
          key={group.groupId}
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            setDragGroupIndex(groupIndex);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragGroupIndex !== null && dragGroupIndex !== groupIndex) reorderGroup(dragGroupIndex, groupIndex);
            setDragGroupIndex(null);
          }}
          className="rounded-lg border border-gray-200 bg-white"
        >
          <div className="flex items-center gap-2 rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-2">
            <span className="flex flex-col text-gray-400">
              <button
                type="button"
                onClick={() => moveGroup(groupIndex, -1)}
                disabled={groupIndex === 0}
                className="leading-none disabled:opacity-30"
                title="Move group up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveGroup(groupIndex, 1)}
                disabled={groupIndex === groups.length - 1}
                className="leading-none disabled:opacity-30"
                title="Move group down"
              >
                ▼
              </button>
            </span>
            <span className="cursor-grab select-none text-gray-300" title="Drag to reorder group">
              ⠿
            </span>
            <div className="flex-1">
              <FieldLabel>Group Name</FieldLabel>
              <input
                className="w-full bg-transparent text-sm font-semibold text-gray-700 placeholder:font-normal placeholder:text-gray-400 focus:outline-none"
                placeholder="Group name (optional)"
                value={group.groupName}
                onChange={(e) => updateGroup(groupIndex, { groupName: e.target.value })}
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => addTask(groupIndex)}>
              + Add Task
            </Button>
            <button
              type="button"
              onClick={() => removeGroup(groupIndex)}
              className="text-gray-400 hover:text-red-600"
              title="Remove group"
            >
              ✕
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {group.tasks.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No tasks in this group yet.</p>
            )}
            {group.tasks.map((task, taskIndex) => (
              <div
                key={task.tempId}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDragTask({ groupIndex, taskIndex });
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragTask && dragTask.groupIndex === groupIndex) {
                    reorderTask(dragTask.groupIndex, dragTask.taskIndex, groupIndex, taskIndex);
                  }
                  setDragTask(null);
                }}
                className="flex items-start gap-2 p-3"
              >
                <span className="flex flex-col pt-6 text-gray-400">
                  <button
                    type="button"
                    onClick={() => moveTask(groupIndex, taskIndex, -1)}
                    disabled={taskIndex === 0}
                    className="leading-none disabled:opacity-30"
                    title="Move task up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTask(groupIndex, taskIndex, 1)}
                    disabled={taskIndex === group.tasks.length - 1}
                    className="leading-none disabled:opacity-30"
                    title="Move task down"
                  >
                    ▼
                  </button>
                </span>
                <span className="cursor-grab select-none pt-6 text-gray-300" title="Drag to reorder task">
                  ⠿
                </span>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6">
                      <FieldLabel>Task Name</FieldLabel>
                      <input
                        className={inputClass}
                        value={task.taskName}
                        onChange={(e) => updateTask(groupIndex, taskIndex, { taskName: e.target.value })}
                      />
                    </div>
                    <div className="col-span-3">
                      <FieldLabel>Start Date</FieldLabel>
                      <input
                        type="date"
                        className={inputClass}
                        value={task.startDate}
                        onChange={(e) => updateTask(groupIndex, taskIndex, { startDate: e.target.value })}
                      />
                    </div>
                    <div className="col-span-3">
                      <FieldLabel>End Date</FieldLabel>
                      <input
                        type="date"
                        className={inputClass}
                        value={task.endDate}
                        onChange={(e) => updateTask(groupIndex, taskIndex, { endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Description (optional)</FieldLabel>
                    <input
                      className={`${inputClass} w-full`}
                      value={task.description}
                      onChange={(e) => updateTask(groupIndex, taskIndex, { description: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeTask(groupIndex, taskIndex)}
                  className="pt-6 text-gray-400 hover:text-red-600"
                  title="Remove task"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
