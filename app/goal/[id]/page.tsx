"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/lib/store";

export default function GoalTreePage() {
  const { id } = useParams<{ id: string }>();
  const { state, ready, addMilestone, toggleMilestone, deleteMilestone } =
    useApp();
  const [title, setTitle] = useState("");

  if (!ready) return null;

  const goal = state.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <div className="py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">Goal not found.</p>
        <Link href="/" className="mt-3 inline-block underline">
          Back to goals
        </Link>
      </div>
    );
  }

  const milestones = state.milestones
    .filter((m) => m.goalId === goal.id)
    .sort((a, b) => a.position - b.position);
  const done = milestones.filter((m) => m.completedAt).length;
  const currentId = milestones.find((m) => !m.completedAt)?.id;

  return (
    <div>
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Goals
      </Link>
      <h1 className="mt-1 text-2xl font-bold">{goal.identity}</h1>
      {milestones.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round((done / milestones.length) * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-zinc-500">
            {done}/{milestones.length}
          </span>
        </div>
      )}

      {milestones.length === 0 && (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          Break this goal into milestones — the levels you&apos;ll clear on the
          way. Start with the first small win.
        </p>
      )}

      {/* the level tree: nodes on a vertical path */}
      <ol className="relative mt-6 space-y-1">
        {milestones.map((milestone, i) => {
          const completed = Boolean(milestone.completedAt);
          const isCurrent = milestone.id === currentId;
          const isLast = i === milestones.length - 1;
          return (
            <li key={milestone.id} className="relative flex gap-4">
              {/* connector line to the next node */}
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-6 top-12 h-[calc(100%-2.5rem)] w-0.5 -translate-x-1/2 ${
                    completed ? "bg-emerald-400" : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              )}
              <button
                onClick={() => toggleMilestone(milestone.id)}
                aria-label={`${completed ? "Un-complete" : "Complete"} ${milestone.title}`}
                className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                  completed
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isCurrent
                      ? "border-amber-500 bg-white text-amber-600 ring-4 ring-amber-100 dark:bg-zinc-900 dark:ring-amber-950"
                      : "border-zinc-300 bg-white text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900"
                }`}
              >
                {completed ? "✓" : milestone.position}
              </button>
              <div
                className={`flex min-w-0 flex-1 items-center justify-between gap-2 pb-8 pt-3 ${
                  !completed && !isCurrent ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className={completed ? "line-through opacity-70" : ""}>
                    {milestone.title}
                  </p>
                  {isCurrent && (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Current level
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteMilestone(milestone.id)}
                  aria-label={`Delete ${milestone.title}`}
                  className="shrink-0 p-1 text-zinc-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          addMilestone(goal.id, title);
          setTitle("");
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            milestones.length === 0
              ? "Save my first $1,000"
              : "Next milestone…"
          }
          className="w-full flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add
        </button>
      </form>
    </div>
  );
}
