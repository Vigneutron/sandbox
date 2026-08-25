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
    desc: "A straight climb — clear milestones one after another.",
  },
  {
    key: "pyramid",
    label: "Pyramid",
    icon: "△",
    desc: "Break the goal into sub-goals and build from the base up — finishing them unlocks the level above.",
  },
  {
    key: "tree",
    label: "Tree",
    icon: "⑂",
    desc: "Like a skill tree — completing a goal unlocks new branches above it.",
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
          className="w-full flex-1 rounded-lg border border-gray-600 bg-navy-900 px-3 py-2 outline-none focus:border-gold-500"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="shrink-0 rounded-lg bg-gold-500 px-4 py-2 font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-40"
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
                ? "bg-gold-500 text-navy-950"
                : "bg-navy-700 text-gray-300"
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-gray-400">
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
          <p className="mx-auto mt-3 max-w-md text-gray-300">
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
          className="mt-4 block rounded-lg border border-gold-500 px-4 py-2 text-center text-sm font-medium text-gold-400 hover:bg-navy-800"
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
              className="relative rounded-lg border border-gray-700 bg-navy-900 transition hover:border-gold-500"
            >
              <Link href={`/goal/${goal.id}`} className="block p-4 pr-12">
                <h2 className="font-semibold">
                  {goal.identity}{" "}
                  <span className="text-xs font-normal uppercase tracking-wide text-gray-500">
                    {goal.structure}
                  </span>
                </h2>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-800">
                    <div
                      className="h-full rounded-full bg-gold-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
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
                className="absolute right-3 top-3 p-1 text-gray-500 hover:text-red-600"
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
