"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { FREE_GOAL_LIMIT, Goal } from "@/lib/types";
import { DAY_LABELS } from "@/lib/dates";
import { currentStreak, completionRate } from "@/lib/streaks";
import { AdBanner } from "@/components/AdBanner";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function GoalForm({ onDone }: { onDone: () => void }) {
  const { addGoal } = useApp();
  const [identity, setIdentity] = useState("");
  const [why, setWhy] = useState("");

  return (
    <form
      className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      onSubmit={(e) => {
        e.preventDefault();
        if (!identity.trim()) return;
        addGoal(identity, why);
        onDone();
      }}
    >
      <label className="block text-sm">
        <span className="font-medium">I am becoming…</span>
        <input
          autoFocus
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder="a runner / a writer / someone who ships"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Why it matters (optional)</span>
        <input
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Energy to keep up with my kids"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add goal
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-4 py-2 text-sm text-zinc-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function HabitForm({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const { addHabit } = useApp();
  const [title, setTitle] = useState("");
  const [cue, setCue] = useState("");
  const [days, setDays] = useState<number[]>(ALL_DAYS);

  const toggleDay = (d: number) =>
    setDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]
    );

  return (
    <form
      className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || days.length === 0) return;
        addHabit(goal.id, title, cue, days);
        onDone();
      }}
    >
      <p className="text-sm text-zinc-500">
        Make it tiny — two minutes or less. You&apos;re building the identity,
        not chasing the outcome.
      </p>
      <label className="block text-sm">
        <span className="font-medium">After…</span>
        <input
          autoFocus
          value={cue}
          onChange={(e) => setCue(e.target.value)}
          placeholder="I pour my morning coffee"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">…I will</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="put on my running shoes"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600"
        />
      </label>
      <div className="text-sm">
        <span className="font-medium">On days</span>
        <div className="mt-1 flex gap-1.5">
          {ALL_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`rounded-md px-2 py-1 text-xs ${
                days.includes(d)
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
              }`}
            >
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add habit
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-4 py-2 text-sm text-zinc-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function GoalsPage() {
  const { state, ready, canAddGoal, deleteGoal, deleteHabit } = useApp();
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingHabitFor, setAddingHabitFor] = useState<string | null>(null);

  if (!ready) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Goals</h1>
        {canAddGoal ? (
          <button
            onClick={() => setAddingGoal(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + New goal
          </button>
        ) : (
          <Link
            href="/upgrade"
            className="rounded-md border border-amber-500 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
          >
            Free plan: {FREE_GOAL_LIMIT} goals max — go Pro
          </Link>
        )}
      </div>

      {addingGoal && <GoalForm onDone={() => setAddingGoal(false)} />}

      {state.goals.length === 0 && !addingGoal && (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          No goals yet. Decide who you want to become, then build the smallest
          habit that proves it.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {state.goals.map((goal) => {
          const habits = state.habits.filter((h) => h.goalId === goal.id);
          return (
            <section
              key={goal.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    I am becoming {goal.identity}
                  </h2>
                  {goal.why && (
                    <p className="text-sm text-zinc-500">{goal.why}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Delete "${goal.identity}" and its habits? This can't be undone.`
                      )
                    )
                      deleteGoal(goal.id);
                  }}
                  className="text-sm text-zinc-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>

              <ul className="mt-3 space-y-2">
                {habits.map((habit) => {
                  const streak = currentStreak(habit, state.completions);
                  const rate = completionRate(habit, state.completions);
                  return (
                    <li
                      key={habit.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                    >
                      <div className="min-w-0">
                        <p className="truncate">{habit.title}</p>
                        <p className="text-xs text-zinc-500">
                          {habit.cue && <>After {habit.cue} · </>}
                          {habit.days.length === 7
                            ? "Every day"
                            : habit.days.map((d) => DAY_LABELS[d]).join(" ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-sm">
                        {streak > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {streak}🔥
                          </span>
                        )}
                        {rate !== null && (
                          <span className="text-zinc-500">{rate}%</span>
                        )}
                        <button
                          onClick={() => deleteHabit(habit.id)}
                          className="text-zinc-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {addingHabitFor === goal.id ? (
                <HabitForm goal={goal} onDone={() => setAddingHabitFor(null)} />
              ) : (
                <button
                  onClick={() => setAddingHabitFor(goal.id)}
                  className="mt-3 text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-300"
                >
                  + Add a tiny habit
                </button>
              )}
            </section>
          );
        })}
      </div>

      <AdBanner />
    </div>
  );
}
