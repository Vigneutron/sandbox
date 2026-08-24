"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { AppState, Goal, Habit, FREE_GOAL_LIMIT } from "./types";
import { todayKey } from "./dates";

const STORAGE_KEY = "momentum-v1";

const EMPTY: AppState = { goals: [], habits: [], completions: {}, pro: false };

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      goals: parsed.goals ?? [],
      habits: parsed.habits ?? [],
      completions: parsed.completions ?? {},
      pro: parsed.pro ?? false,
    };
  } catch {
    return EMPTY;
  }
}

interface AppContextValue {
  state: AppState;
  /** false until localStorage has been read on the client */
  ready: boolean;
  canAddGoal: boolean;
  addGoal: (identity: string, why: string) => void;
  deleteGoal: (goalId: string) => void;
  addHabit: (goalId: string, title: string, cue: string, days: number[]) => void;
  deleteHabit: (habitId: string) => void;
  toggleToday: (habitId: string) => void;
  upgrade: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // localStorage is client-only; hydrating here (not in the initializer)
    // keeps server and first client render identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or unavailable — keep running in memory
    }
  }, [state, ready]);

  const addGoal = useCallback((identity: string, why: string) => {
    const goal: Goal = {
      id: crypto.randomUUID(),
      identity: identity.trim(),
      why: why.trim(),
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, goals: [...s.goals, goal] }));
  }, []);

  const deleteGoal = useCallback((goalId: string) => {
    setState((s) => {
      const habits = s.habits.filter((h) => h.goalId !== goalId);
      const removed = new Set(
        s.habits.filter((h) => h.goalId === goalId).map((h) => h.id)
      );
      const completions = Object.fromEntries(
        Object.entries(s.completions).filter(([id]) => !removed.has(id))
      );
      return {
        ...s,
        goals: s.goals.filter((g) => g.id !== goalId),
        habits,
        completions,
      };
    });
  }, []);

  const addHabit = useCallback(
    (goalId: string, title: string, cue: string, days: number[]) => {
      const habit: Habit = {
        id: crypto.randomUUID(),
        goalId,
        title: title.trim(),
        cue: cue.trim(),
        days: [...days].sort(),
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, habits: [...s.habits, habit] }));
    },
    []
  );

  const deleteHabit = useCallback((habitId: string) => {
    setState((s) => {
      const completions = { ...s.completions };
      delete completions[habitId];
      return {
        ...s,
        habits: s.habits.filter((h) => h.id !== habitId),
        completions,
      };
    });
  }, []);

  const toggleToday = useCallback((habitId: string) => {
    const key = todayKey();
    setState((s) => {
      const dates = s.completions[habitId] ?? [];
      const next = dates.includes(key)
        ? dates.filter((d) => d !== key)
        : [...dates, key];
      return { ...s, completions: { ...s.completions, [habitId]: next } };
    });
  }, []);

  const upgrade = useCallback(() => {
    setState((s) => ({ ...s, pro: true }));
  }, []);

  const canAddGoal = state.pro || state.goals.length < FREE_GOAL_LIMIT;

  return (
    <AppContext.Provider
      value={{
        state,
        ready,
        canAddGoal,
        addGoal,
        deleteGoal,
        addHabit,
        deleteHabit,
        toggleToday,
        upgrade,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
