/**
 * How a goal's milestones are organized:
 * - linear: a straight path, one milestone after another
 * - pyramid: nested sub-goals under one root goal
 * - tree: like a game skill tree — completing a node unlocks its children
 */
export type GoalStructure = "linear" | "pyramid" | "tree";

export interface Goal {
  id: string;
  /** free-form goal title (the database column keeps its legacy name "identity") */
  identity: string;
  /** legacy field, no longer collected but still displayed if present */
  why: string;
  structure: GoalStructure;
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
  pro: boolean;
}

export const FREE_GOAL_LIMIT = 2;
