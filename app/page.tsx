"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { FREE_GOAL_LIMIT, GoalStructure } from "@/lib/types";
import { AdBanner } from "@/components/AdBanner";

const STRUCTURES: { key: GoalStructure; label: string; icon: string; desc: string }[] = [
  {
    key: "linear",
    label: "Linear",
    icon: "→",
    desc: "A straight path — clear milestones one after another.",
  },
  {
    key: "pyramid",
    label: "Pyramid",
    icon: "△",
    desc: "One big goal broken into sub-goals, and those into smaller ones.",
  },
  {
    key: "tree",
    label: "Tree",
    icon: "⑂",
    desc: "Like a skill tree — completing a goal unlocks new ones.",
  },
];

function GoalForm() {
  const { addGoal } = useApp();
  const [title, setTitle] = useState("");
  const [structure, setStructure] = useState<GoalStructure>("linear");

  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        addGoal(title, structure);
        setTitle("");
      }}
    >
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Become a millionaire"
          className="w-full flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {STRUCTURES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStructure(s.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              structure === s.key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">
        {STRUCTURES.find((s) => s.key === structure)?.desc}
      </p>
    </form>
  );
}

export default function DashboardPage() {
  const { state, ready, canAddGoal, deleteGoal } = useApp();

  if (!ready) return null;

  return (
    <div>
      {state.goals.length === 0 ? (
        <div className="pt-12 text-center">
          <h1 className="text-2xl font-bold">Welcome to Goal Goal Gadget</h1>
          <p className="mx-auto mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
            Name a big goal, then break it into milestones — a level tree you
            climb one node at a time.
          </p>
        </div>
      ) : (
        <h1 className="text-2xl font-bold">Goals</h1>
      )}

      {canAddGoal ? (
        <GoalForm />
      ) : (
        <Link
          href="/upgrade"
          className="mt-4 block rounded-lg border border-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
        >
          Free plan: {FREE_GOAL_LIMIT} goals max — go Pro for unlimited
        </Link>
      )}

      <div className="mt-6 space-y-3">
        {state.goals.map((goal) => {
          const milestones = state.milestones.filter((m) => m.goalId === goal.id);
          const done = milestones.filter((m) => m.completedAt).length;
          const pct =
            milestones.length === 0 ? 0 : Math.round((done / milestones.length) * 100);
          return (
            <div
              key={goal.id}
              className="relative rounded-lg border border-zinc-200 bg-white transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <Link href={`/goal/${goal.id}`} className="block p-4 pr-12">
                <h2 className="font-semibold">
                  {goal.identity}{" "}
                  <span className="text-xs font-normal uppercase tracking-wide text-zinc-400">
                    {goal.structure}
                  </span>
                </h2>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {milestones.length === 0
                      ? "No milestones yet"
                      : `${done}/${milestones.length}`}
                  </span>
                </div>
              </Link>
              <button
                onClick={() => {
                  if (
                    confirm(`Delete "${goal.identity}"? This can't be undone.`)
                  )
                    deleteGoal(goal.id);
                }}
                aria-label={`Delete ${goal.identity}`}
                className="absolute right-3 top-3 p-1 text-zinc-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <AdBanner />
    </div>
  );
}
