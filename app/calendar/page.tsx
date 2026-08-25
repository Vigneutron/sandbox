"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import {
  DAY_LABELS,
  addDays,
  dateKey,
  formatDay,
  isDueOn,
  todayKey,
} from "@/lib/dates";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function CalendarPage() {
  const { state, ready, toggleHabitToday } = useApp();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string>(todayKey());

  if (!ready) return null;

  const today = todayKey();
  const habits = state.goals.filter((g) => g.structure === "habit");
  const deadlineGoals = state.goals.filter((g) => g.deadline);

  const habitsOn = (d: Date) => {
    const key = dateKey(d);
    return habits.filter(
      (g) =>
        isDueOn(g.days ?? [], d) && key >= dateKey(new Date(g.createdAt))
    );
  };
  const deadlinesOn = (key: string) =>
    deadlineGoals.filter((g) => g.deadline === key);

  // grid from the Sunday on/before the 1st through the Saturday on/after the last day
  const gridStart = addDays(month, -month.getDay());
  const cells: Date[] = [];
  for (let d = gridStart; ; d = addDays(d, 1)) {
    cells.push(d);
    if (
      cells.length % 7 === 0 &&
      d >= new Date(month.getFullYear(), month.getMonth() + 1, 0)
    )
      break;
  }

  const selectedDate = (() => {
    const [y, m, d] = selected.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();
  const selectedHabits = habitsOn(selectedDate);
  const selectedDeadlines = deadlinesOn(selected);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            className="rounded-md px-3 py-1 text-lg hover:bg-navy-800"
          >
            ‹
          </button>
          <span className="min-w-32 text-center text-sm font-medium">
            {month.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            className="rounded-md px-3 py-1 text-lg hover:bg-navy-800"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
        {DAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const key = dateKey(d);
          const inMonth = d.getMonth() === month.getMonth();
          const dayHabits = habitsOn(d);
          const dayDeadlines = deadlinesOn(key);
          const isSelected = key === selected;
          const isToday = key === today;
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`flex min-h-16 flex-col items-center gap-0.5 rounded-lg border p-1 ${
                isSelected
                  ? "border-gold-500 bg-navy-800"
                  : "border-transparent hover:bg-navy-900"
              } ${inMonth ? "" : "opacity-35"}`}
            >
              <span
                className={`text-sm ${
                  isToday ? "font-bold text-gold-400" : "text-gray-200"
                }`}
              >
                {d.getDate()}
              </span>
              {dayDeadlines.length > 0 && (
                <span className="text-[10px] leading-none text-gold-300">
                  {"◆".repeat(Math.min(dayDeadlines.length, 3))}
                </span>
              )}
              {dayHabits.length > 0 && (
                <span className="flex gap-0.5">
                  {dayHabits.slice(0, 3).map((g) => {
                    const done = (state.habitCompletions[g.id] ?? []).includes(key);
                    return (
                      <span
                        key={g.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          done
                            ? "bg-gold-500"
                            : key <= today
                              ? "bg-gray-600"
                              : "border border-gray-600"
                        }`}
                      />
                    );
                  })}
                  {dayHabits.length > 3 && (
                    <span className="text-[9px] leading-none text-gray-500">
                      +{dayHabits.length - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-gray-700 bg-navy-900 p-4">
        <p className="text-sm font-medium text-gray-300">
          {selected === today ? "Today" : formatDay(selected)}
        </p>

        {selectedDeadlines.length === 0 && selectedHabits.length === 0 && (
          <p className="mt-2 text-sm text-gray-400">
            Nothing scheduled — no habits due, no deadlines.
          </p>
        )}

        {selectedDeadlines.map((g) => {
          const milestones = state.milestones.filter((m) => m.goalId === g.id);
          const done = milestones.filter((m) => m.completedAt).length;
          const complete =
            milestones.length > 0 && done === milestones.length;
          return (
            <Link
              key={g.id}
              href={`/goal/${g.id}`}
              className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-gold-600 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="text-gold-300">◆ Deadline:</span> {g.identity}
              </span>
              <span className="shrink-0 text-xs text-gray-400">
                {milestones.length > 0 && `${done}/${milestones.length}`}
                {complete && " ✓"}
              </span>
            </Link>
          );
        })}

        {selectedHabits.map((g) => {
          const done = (state.habitCompletions[g.id] ?? []).includes(selected);
          const canToggle = selected === today;
          return (
            <div
              key={g.id}
              className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-gray-700 px-3 py-2"
            >
              <Link href={`/goal/${g.id}`} className="min-w-0 flex-1">
                {g.identity}
                {g.cue && (
                  <span className="block text-xs text-gray-400">
                    after {g.cue}
                  </span>
                )}
              </Link>
              {canToggle ? (
                <button
                  onClick={() => toggleHabitToday(g.id)}
                  aria-label={
                    done ? `Un-complete ${g.identity}` : `Complete ${g.identity}`
                  }
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                    done
                      ? "border-gold-400 bg-gold-500 text-ongold"
                      : "border-gray-100 bg-navy-950 text-gray-100"
                  }`}
                >
                  {done ? "✓" : "○"}
                </button>
              ) : (
                <span
                  className={`shrink-0 text-sm ${
                    done
                      ? "text-gold-400"
                      : selected < today
                        ? "text-gray-500"
                        : "text-gray-400"
                  }`}
                >
                  {done ? "✓ done" : selected < today ? "missed" : "scheduled"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
