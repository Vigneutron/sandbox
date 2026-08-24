"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { todayKey, isDueOn } from "@/lib/dates";
import { currentStreak } from "@/lib/streaks";
import { AdBanner } from "@/components/AdBanner";

export default function TodayPage() {
  const { state, ready, toggleToday } = useApp();

  if (!ready) return null;

  const today = new Date();
  const key = todayKey();
  const dueHabits = state.habits.filter((h) => isDueOn(h.days, today));
  const doneCount = dueHabits.filter((h) =>
    (state.completions[h.id] ?? []).includes(key)
  ).length;

  if (state.goals.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Welcome to Momentum</h1>
        <p className="mx-auto mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
          Every action you take is a vote for the person you want to become.
          Start by naming who that is.
        </p>
        <Link
          href="/goals"
          className="mt-6 inline-block rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Create your first goal
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Today</h1>
        {dueHabits.length > 0 && (
          <span className="text-sm text-zinc-500">
            {doneCount}/{dueHabits.length} done
          </span>
        )}
      </div>

      {dueHabits.length === 0 && (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          Nothing scheduled today. Rest is part of the system — or{" "}
          <Link href="/goals" className="underline">
            add a habit
          </Link>
          .
        </p>
      )}

      <div className="mt-4 space-y-6">
        {state.goals.map((goal) => {
          const habits = dueHabits.filter((h) => h.goalId === goal.id);
          if (habits.length === 0) return null;
          return (
            <section key={goal.id}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                I am becoming {goal.identity}
              </h2>
              <ul className="mt-2 space-y-2">
                {habits.map((habit) => {
                  const done = (state.completions[habit.id] ?? []).includes(key);
                  const streak = currentStreak(habit, state.completions);
                  return (
                    <li key={habit.id}>
                      <button
                        onClick={() => toggleToday(habit.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                          done
                            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
                            : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm ${
                            done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-zinc-300 dark:border-zinc-600"
                          }`}
                        >
                          {done ? "✓" : ""}
                        </span>
                        <span className="flex-1">
                          <span
                            className={done ? "line-through opacity-60" : ""}
                          >
                            {habit.title}
                          </span>
                          {habit.cue && (
                            <span className="block text-sm text-zinc-500">
                              After {habit.cue}
                            </span>
                          )}
                        </span>
                        {streak > 0 && (
                          <span className="shrink-0 text-sm font-medium text-amber-600 dark:text-amber-400">
                            {streak} day{streak === 1 ? "" : "s"} 🔥
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <AdBanner />
    </div>
  );
}
