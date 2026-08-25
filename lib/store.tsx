"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import type { User } from "@supabase/supabase-js";
import { AppState, Goal, Habit, FREE_GOAL_LIMIT } from "./types";
import { todayKey } from "./dates";
import { getSupabase } from "./supabase";

const STORAGE_KEY = "goal-goal-gadget-v1";

const EMPTY: AppState = { goals: [], habits: [], completions: {}, pro: false };

function loadLocal(): AppState {
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

/** Log-and-continue for cloud writes: the UI state is already updated and
 *  persisted locally, so a failed network write must not crash the app. */
function logError(op: string) {
  return ({ error }: { error: { message: string } | null }) => {
    if (error) console.error(`supabase ${op}:`, error.message);
  };
}

interface AppContextValue {
  state: AppState;
  /** false until localStorage (and any session) has been read on the client */
  ready: boolean;
  canAddGoal: boolean;
  /** true when Supabase env vars are configured */
  cloudEnabled: boolean;
  user: User | null;
  addGoal: (identity: string, why: string) => void;
  deleteGoal: (goalId: string) => void;
  addHabit: (goalId: string, title: string, cue: string, days: number[]) => void;
  deleteHabit: (habitId: string) => void;
  toggleToday: (habitId: string) => void;
  /** re-reads Pro status from the database (e.g. after Stripe checkout) */
  refreshPro: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const cloudEnabled = getSupabase() !== null;

  useEffect(() => {
    // localStorage is client-only; hydrating here (not in the initializer)
    // keeps server and first client render identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadLocal());
    setReady(true);

    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // On sign-in: pull the account's data. If the account is empty and this
  // device has local data, migrate it up first so nothing is lost.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    if (!user) {
      // back to this device's own data after sign-out; localStorage is the
      // external system being synchronized from
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (ready) setState(loadLocal());
      return;
    }
    let cancelled = false;

    (async () => {
      const [g, h, c, p] = await Promise.all([
        sb.from("goals").select("*").order("created_at"),
        sb.from("habits").select("*").order("created_at"),
        sb.from("completions").select("habit_id,date"),
        sb.from("profiles").select("pro").maybeSingle(),
      ]);
      if (g.error || h.error || c.error) {
        console.error(
          "supabase load:",
          g.error?.message ?? h.error?.message ?? c.error?.message
        );
        return;
      }

      const local = loadLocal();
      const cloudEmpty = g.data.length === 0 && h.data.length === 0;

      if (cloudEmpty && local.goals.length > 0) {
        await sb
          .from("goals")
          .insert(
            local.goals.map((goal) => ({
              id: goal.id,
              user_id: user.id,
              identity: goal.identity,
              why: goal.why,
              created_at: goal.createdAt,
            }))
          )
          .then(logError("migrate goals"));
        if (local.habits.length > 0) {
          await sb
            .from("habits")
            .insert(
              local.habits.map((habit) => ({
                id: habit.id,
                user_id: user.id,
                goal_id: habit.goalId,
                title: habit.title,
                cue: habit.cue,
                days: habit.days,
                created_at: habit.createdAt,
              }))
            )
            .then(logError("migrate habits"));
        }
        const rows = Object.entries(local.completions).flatMap(
          ([habitId, dates]) =>
            dates.map((date) => ({
              habit_id: habitId,
              user_id: user.id,
              date,
            }))
        );
        if (rows.length > 0) {
          await sb
            .from("completions")
            .insert(rows)
            .then(logError("migrate completions"));
        }
        if (!cancelled) setState({ ...local, pro: p.data?.pro ?? false });
        return;
      }

      const completions: Record<string, string[]> = {};
      for (const row of c.data as { habit_id: string; date: string }[]) {
        (completions[row.habit_id] ??= []).push(row.date);
      }
      if (!cancelled) {
        setState({
          goals: g.data.map((r) => ({
            id: r.id,
            identity: r.identity,
            why: r.why ?? "",
            createdAt: r.created_at,
          })),
          habits: h.data.map((r) => ({
            id: r.id,
            goalId: r.goal_id,
            title: r.title,
            cue: r.cue ?? "",
            days: r.days,
            createdAt: r.created_at,
          })),
          completions,
          pro: p.data?.pro ?? false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or unavailable — keep running in memory
    }
  }, [state, ready]);

  const addGoal = useCallback(
    (identity: string, why: string) => {
      const goal: Goal = {
        id: crypto.randomUUID(),
        identity: identity.trim(),
        why: why.trim(),
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, goals: [...s.goals, goal] }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("goals")
          .insert({
            id: goal.id,
            user_id: user.id,
            identity: goal.identity,
            why: goal.why,
            created_at: goal.createdAt,
          })
          .then(logError("add goal"));
      }
    },
    [user]
  );

  const deleteGoal = useCallback(
    (goalId: string) => {
      setState((s) => {
        const removed = new Set(
          s.habits.filter((h) => h.goalId === goalId).map((h) => h.id)
        );
        const completions = Object.fromEntries(
          Object.entries(s.completions).filter(([id]) => !removed.has(id))
        );
        return {
          ...s,
          goals: s.goals.filter((g) => g.id !== goalId),
          habits: s.habits.filter((h) => h.goalId !== goalId),
          completions,
        };
      });
      const sb = getSupabase();
      if (sb && user) {
        // habits/completions cascade in the database
        sb.from("goals").delete().eq("id", goalId).then(logError("delete goal"));
      }
    },
    [user]
  );

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
      const sb = getSupabase();
      if (sb && user) {
        sb.from("habits")
          .insert({
            id: habit.id,
            user_id: user.id,
            goal_id: habit.goalId,
            title: habit.title,
            cue: habit.cue,
            days: habit.days,
            created_at: habit.createdAt,
          })
          .then(logError("add habit"));
      }
    },
    [user]
  );

  const deleteHabit = useCallback(
    (habitId: string) => {
      setState((s) => {
        const completions = { ...s.completions };
        delete completions[habitId];
        return {
          ...s,
          habits: s.habits.filter((h) => h.id !== habitId),
          completions,
        };
      });
      const sb = getSupabase();
      if (sb && user) {
        sb.from("habits")
          .delete()
          .eq("id", habitId)
          .then(logError("delete habit"));
      }
    },
    [user]
  );

  const toggleToday = useCallback(
    (habitId: string) => {
      const key = todayKey();
      let added = false;
      setState((s) => {
        const dates = s.completions[habitId] ?? [];
        added = !dates.includes(key);
        const next = added ? [...dates, key] : dates.filter((d) => d !== key);
        return { ...s, completions: { ...s.completions, [habitId]: next } };
      });
      const sb = getSupabase();
      if (sb && user) {
        if (added) {
          sb.from("completions")
            .upsert({ habit_id: habitId, user_id: user.id, date: key })
            .then(logError("complete habit"));
        } else {
          sb.from("completions")
            .delete()
            .eq("habit_id", habitId)
            .eq("date", key)
            .then(logError("uncomplete habit"));
        }
      }
    },
    [user]
  );

  const refreshPro = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user) return;
    const { data } = await sb.from("profiles").select("pro").maybeSingle();
    if (data) setState((s) => ({ ...s, pro: data.pro }));
  }, [user]);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return "Accounts are not configured yet.";
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.session) return "Check your email to confirm your account, then sign in.";
    return null;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return "Accounts are not configured yet.";
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    // signed-out devices go back to their own local data
    localStorage.removeItem(STORAGE_KEY);
    setState(EMPTY);
  }, []);

  const canAddGoal = state.pro || state.goals.length < FREE_GOAL_LIMIT;

  return (
    <AppContext.Provider
      value={{
        state,
        ready,
        canAddGoal,
        cloudEnabled,
        user,
        addGoal,
        deleteGoal,
        addHabit,
        deleteHabit,
        toggleToday,
        refreshPro,
        signUp,
        signIn,
        signOut,
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
