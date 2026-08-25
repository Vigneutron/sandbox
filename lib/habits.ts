import { dateKey, addDays, isDueOn } from "./dates";

/**
 * Current streak: consecutive scheduled days completed, counting back from
 * today. An unfinished today doesn't break the streak — there's still time.
 */
export function currentStreak(
  days: number[],
  completedDates: string[],
  createdAt: string
): number {
  if (days.length === 0) return 0;
  const done = new Set(completedDates);
  const created = new Date(createdAt);
  created.setHours(0, 0, 0, 0);
  const today = todayLocal();

  let streak = 0;
  let d = new Date();
  for (let i = 0; i < 3660; i++) {
    if (isDueOn(days, d)) {
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

/** Completion rate over the last `windowDays`, counting only scheduled days */
export function completionRate(
  days: number[],
  completedDates: string[],
  createdAt: string,
  windowDays = 30
): number | null {
  const done = new Set(completedDates);
  const created = new Date(createdAt);
  created.setHours(0, 0, 0, 0);

  let scheduled = 0;
  let completed = 0;
  let d = new Date();
  for (let i = 0; i < windowDays; i++) {
    if (d < created) break;
    if (isDueOn(days, d)) {
      scheduled++;
      if (done.has(dateKey(d))) completed++;
    }
    d = addDays(d, -1);
  }
  if (scheduled === 0) return null;
  return Math.round((completed / scheduled) * 100);
}

function todayLocal(): string {
  return dateKey(new Date());
}
