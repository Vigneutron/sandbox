import { Habit, Completions } from "./types";
import { dateKey, addDays, isDueOn } from "./dates";

/**
 * Current streak: consecutive scheduled days completed, counting back from
 * today. An unfinished today doesn't break the streak — there's still time.
 */
export function currentStreak(habit: Habit, completions: Completions): number {
  const done = new Set(completions[habit.id] ?? []);
  if (habit.days.length === 0) return 0;

  let streak = 0;
  let d = new Date();
  const today = dateKey(d);
  const created = new Date(habit.createdAt);

  for (let i = 0; i < 3660; i++) {
    if (isDueOn(habit.days, d)) {
      const key = dateKey(d);
      if (done.has(key)) {
        streak++;
      } else if (key === today) {
        // still open — skip without breaking
      } else {
        break;
      }
    }
    if (d < created) break;
    d = addDays(d, -1);
  }
  return streak;
}

/** Completion rate over the last `windowDays` days, counting only scheduled days */
export function completionRate(
  habit: Habit,
  completions: Completions,
  windowDays = 30
): number | null {
  const done = new Set(completions[habit.id] ?? []);
  const created = new Date(habit.createdAt);
  created.setHours(0, 0, 0, 0);

  let scheduled = 0;
  let completed = 0;
  let d = new Date();
  for (let i = 0; i < windowDays; i++) {
    if (d < created) break;
    if (isDueOn(habit.days, d)) {
      scheduled++;
      if (done.has(dateKey(d))) completed++;
    }
    d = addDays(d, -1);
  }
  if (scheduled === 0) return null;
  return Math.round((completed / scheduled) * 100);
}
