/**
 * How a goal is organized:
 * - linear: a straight path, one milestone after another
 * - pyramid: nested sub-goals under one root goal
 * - tree: like a game skill tree — completing a node unlocks its children
 * - habit: repeats on a weekly schedule with streaks; no milestones
 */
export type GoalStructure = "linear" | "pyramid" | "tree" | "habit";

export interface Goal {
  id: string;
  /** free-form goal title (the database column keeps its legacy name "identity") */
  identity: string;
  /** legacy field, no longer collected but still displayed if present */
  why: string;
  structure: GoalStructure;
  /** habit goals: scheduled weekdays (0 = Sunday … 6 = Saturday); null otherwise */
  days: number[] | null;
  /** habit goals: stacking cue, shown as "After {cue}, I will {title}" */
  cue: string;
  /** optional target date as a YYYY-MM-DD key */
  deadline: string | null;
  createdAt: string;
}

export interface Milestone {
  id: string;
  goalId: string;
  /** parent milestone for pyramid/tree structures; null for roots and linear */
  parentId: string | null;
  title: string;
  /** order among siblings, 1-based */
  position: number;
  completedAt: string | null;
  createdAt: string;
}

export interface AppState {
  goals: Goal[];
  milestones: Milestone[];
  /** habit goalId -> completed dates as YYYY-MM-DD keys */
  habitCompletions: Record<string, string[]>;
  pro: boolean;
}

export const FREE_GOAL_LIMIT = 2;
