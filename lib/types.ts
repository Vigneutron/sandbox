export interface Goal {
  id: string;
  /** free-form goal title (the database column keeps its legacy name "identity") */
  identity: string;
  /** legacy field, no longer collected but still displayed if present */
  why: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  /** order within the goal's tree, 1-based */
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
