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
import { AppState, Goal, Milestone, FREE_GOAL_LIMIT } from "./types";
import { getSupabase } from "./supabase";

const STORAGE_KEY = "goal-goal-gadget-v1";

const EMPTY: AppState = { goals: [], milestones: [], pro: false };

function loadLocal(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      goals: parsed.goals ?? [],
      milestones: parsed.milestones ?? [],
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
  addGoal: (title: string) => string;
  deleteGoal: (goalId: string) => void;
  addMilestone: (goalId: string, title: string) => void;
  toggleMilestone: (milestoneId: string) => void;
  deleteMilestone: (milestoneId: string) => void;
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
      const [g, m, p] = await Promise.all([
        sb.from("goals").select("*").order("created_at"),
        sb.from("milestones").select("*").order("position"),
        sb.from("profiles").select("pro").maybeSingle(),
      ]);
      if (g.error || m.error) {
        console.error("supabase load:", g.error?.message ?? m.error?.message);
        return;
      }

      const local = loadLocal();
      const cloudEmpty = g.data.length === 0;

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
        if (local.milestones.length > 0) {
          await sb
            .from("milestones")
            .insert(
              local.milestones.map((ms) => ({
                id: ms.id,
                user_id: user.id,
                goal_id: ms.goalId,
                title: ms.title,
                position: ms.position,
                completed_at: ms.completedAt,
                created_at: ms.createdAt,
              }))
            )
            .then(logError("migrate milestones"));
        }
        if (!cancelled) setState({ ...local, pro: p.data?.pro ?? false });
        return;
      }

      if (!cancelled) {
        setState({
          goals: g.data.map((r) => ({
            id: r.id,
            identity: r.identity,
            why: r.why ?? "",
            createdAt: r.created_at,
          })),
          milestones: m.data.map((r) => ({
            id: r.id,
            goalId: r.goal_id,
            title: r.title,
            position: r.position,
            completedAt: r.completed_at,
            createdAt: r.created_at,
          })),
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
    (title: string) => {
      const goal: Goal = {
        id: crypto.randomUUID(),
        identity: title.trim(),
        why: "",
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
      return goal.id;
    },
    [user]
  );

  const deleteGoal = useCallback(
    (goalId: string) => {
      setState((s) => ({
        ...s,
        goals: s.goals.filter((g) => g.id !== goalId),
        milestones: s.milestones.filter((m) => m.goalId !== goalId),
      }));
      const sb = getSupabase();
      if (sb && user) {
        // milestones cascade in the database
        sb.from("goals").delete().eq("id", goalId).then(logError("delete goal"));
      }
    },
    [user]
  );

  const addMilestone = useCallback(
    (goalId: string, title: string) => {
      const position =
        Math.max(
          0,
          ...state.milestones
            .filter((m) => m.goalId === goalId)
            .map((m) => m.position)
        ) + 1;
      const milestone: Milestone = {
        id: crypto.randomUUID(),
        goalId,
        title: title.trim(),
        position,
        completedAt: null,
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, milestones: [...s.milestones, milestone] }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .insert({
            id: milestone.id,
            user_id: user.id,
            goal_id: milestone.goalId,
            title: milestone.title,
            position: milestone.position,
            completed_at: null,
            created_at: milestone.createdAt,
          })
          .then(logError("add milestone"));
      }
    },
    [user, state.milestones]
  );

  const toggleMilestone = useCallback(
    (milestoneId: string) => {
      const target = state.milestones.find((m) => m.id === milestoneId);
      if (!target) return;
      const completedAt = target.completedAt ? null : new Date().toISOString();
      setState((s) => ({
        ...s,
        milestones: s.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completedAt } : m
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .update({ completed_at: completedAt })
          .eq("id", milestoneId)
          .then(logError("toggle milestone"));
      }
    },
    [user, state.milestones]
  );

  const deleteMilestone = useCallback(
    (milestoneId: string) => {
      setState((s) => ({
        ...s,
        milestones: s.milestones.filter((m) => m.id !== milestoneId),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .delete()
          .eq("id", milestoneId)
          .then(logError("delete milestone"));
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
        addMilestone,
        toggleMilestone,
        deleteMilestone,
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
