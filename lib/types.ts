export interface Goal {
  id: string;
  /** Identity-based goal, e.g. "a runner" (rendered as "I am becoming a runner") */
  identity: string;
  /** Why this matters — shown as a reminder on the Today view */
  why: string;
  createdAt: string;
}

export interface Habit {
  id: string;
  goalId: string;
  /** The tiny action, e.g. "put on my running shoes" */
  title: string;
  /** Implementation-intention cue, e.g. "I pour my morning coffee" */
  cue: string;
  /** Scheduled weekdays, 0 = Sunday … 6 = Saturday */
  days: number[];
  createdAt: string;
}

/** habitId -> list of completed dates as YYYY-MM-DD keys */
export type Completions = Record<string, string[]>;

export interface AppState {
  goals: Goal[];
  habits: Habit[];
  completions: Completions;
  pro: boolean;
}

export const FREE_GOAL_LIMIT = 2;
