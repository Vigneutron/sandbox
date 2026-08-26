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
import {
  AppState,
  Goal,
  GoalStructure,
  MachineEdge,
  Milestone,
  TemplateBundle,
  FREE_GOAL_LIMIT,
} from "./types";
import { getSupabase } from "./supabase";
import { todayKey } from "./dates";

const STORAGE_KEY = "goal-goal-gadget-v1";

const EMPTY: AppState = {
  goals: [],
  milestones: [],
  edges: [],
  habitCompletions: {},
  pro: false,
};

function loadLocal(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      // defaults cover data saved before structures/nesting existed
      goals: (parsed.goals ?? []).map((g) => ({
        ...g,
        structure: g.structure ?? "linear",
        days: g.days ?? null,
        cue: g.cue ?? "",
        deadline: g.deadline ?? null,
      })),
      milestones: (parsed.milestones ?? []).map((m) => ({
        ...m,
        parentId: m.parentId ?? null,
        x: m.x ?? null,
        y: m.y ?? null,
        loopTarget: m.loopTarget ?? null,
        loopCount: m.loopCount ?? 0,
        loopLast: m.loopLast ?? null,
        hookSourceId: m.hookSourceId ?? null,
      })),
      edges: parsed.edges ?? [],
      habitCompletions: parsed.habitCompletions ?? {},
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
  addGoal: (title: string, structure: GoalStructure) => string;
  deleteGoal: (goalId: string) => void;
  addMilestone: (goalId: string, title: string, parentId?: string | null) => void;
  /** seeds one example goal of each structure, partly completed */
  addSampleGoals: () => void;
  /** habit goals: toggle today's completion */
  toggleHabitToday: (goalId: string) => void;
  /** habit goals: update schedule and stacking cue */
  updateHabitConfig: (goalId: string, days: number[], cue: string) => void;
  /** set or clear a goal's target date (YYYY-MM-DD or null) */
  updateGoalDeadline: (goalId: string, deadline: string | null) => void;
  /** machine goals: add a step at a canvas position */
  addMachineNode: (goalId: string, title: string, x: number, y: number) => void;
  /** machine goals: persist a dragged step's position */
  moveNode: (milestoneId: string, x: number, y: number) => void;
  /** machine goals: connect two steps with a directed path */
  addEdge: (goalId: string, fromId: string, toId: string) => void;
  deleteEdge: (edgeId: string) => void;
  /** make a step a loop needing `target` reps (null clears the loop) */
  setLoop: (milestoneId: string, target: number | null) => void;
  /** count one rep on a loop step (at most one per day) */
  tapLoop: (milestoneId: string) => void;
  /** Pro hooks: auto-complete this step when another one completes */
  setHook: (milestoneId: string, sourceId: string | null) => void;
  toggleMilestone: (milestoneId: string) => void;
  deleteMilestone: (milestoneId: string) => void;
  /** copies one of the user's goals into the public template library */
  publishGoal: (goalId: string) => Promise<string | null>;
  /** rename a goal */
  updateGoalTitle: (goalId: string, title: string) => void;
  /** rename a milestone/step */
  updateMilestoneTitle: (milestoneId: string, title: string) => void;
  /** creates every goal in a template bundle; returns the first new goal id */
  importBundle: (bundle: TemplateBundle) => { error: string | null; goalId?: string };
  /** re-reads Pro status from the database (e.g. after Stripe checkout) */
  refreshPro: () => Promise<void>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<string | null>;
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
      const [g, m, e, hc, p] = await Promise.all([
        sb.from("goals").select("*").order("created_at"),
        sb.from("milestones").select("*").order("position"),
        sb.from("machine_edges").select("*"),
        sb.from("habit_completions").select("goal_id,date"),
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
              structure: goal.structure,
              days: goal.days,
              cue: goal.cue,
              deadline: goal.deadline,
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
                parent_id: ms.parentId,
                title: ms.title,
                position: ms.position,
                pos_x: ms.x,
                pos_y: ms.y,
                loop_target: ms.loopTarget,
                loop_count: ms.loopCount,
                loop_last: ms.loopLast,
                hook_source_id: ms.hookSourceId,
                completed_at: ms.completedAt,
                created_at: ms.createdAt,
              }))
            )
            .then(logError("migrate milestones"));
          if (local.edges.length > 0) {
            await sb
              .from("machine_edges")
              .insert(
                local.edges.map((edge) => ({
                  id: edge.id,
                  user_id: user.id,
                  goal_id: edge.goalId,
                  from_id: edge.fromId,
                  to_id: edge.toId,
                }))
              )
              .then(logError("migrate edges"));
          }
        }
        const completionRows = Object.entries(local.habitCompletions).flatMap(
          ([goalId, dates]) =>
            dates.map((date) => ({ goal_id: goalId, user_id: user.id, date }))
        );
        if (completionRows.length > 0) {
          await sb
            .from("habit_completions")
            .insert(completionRows)
            .then(logError("migrate habit completions"));
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
            structure: r.structure ?? "linear",
            days: r.days ?? null,
            cue: r.cue ?? "",
            deadline: r.deadline ?? null,
            createdAt: r.created_at,
          })),
          milestones: m.data.map((r) => ({
            id: r.id,
            goalId: r.goal_id,
            parentId: r.parent_id ?? null,
            title: r.title,
            position: r.position,
            x: r.pos_x ?? null,
            y: r.pos_y ?? null,
            loopTarget: r.loop_target ?? null,
            loopCount: r.loop_count ?? 0,
            loopLast: r.loop_last ?? null,
            hookSourceId: r.hook_source_id ?? null,
            completedAt: r.completed_at,
            createdAt: r.created_at,
          })),
          edges: ((e.data ?? []) as {
            id: string;
            goal_id: string;
            from_id: string;
            to_id: string;
          }[]).map((r) => ({
            id: r.id,
            goalId: r.goal_id,
            fromId: r.from_id,
            toId: r.to_id,
          })),
          habitCompletions: (
            (hc.data ?? []) as { goal_id: string; date: string }[]
          ).reduce<Record<string, string[]>>((acc, row) => {
            (acc[row.goal_id] ??= []).push(row.date);
            return acc;
          }, {}),
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
    (title: string, structure: GoalStructure) => {
      const goal: Goal = {
        id: crypto.randomUUID(),
        identity: title.trim(),
        why: "",
        structure,
        days: structure === "habit" ? [0, 1, 2, 3, 4, 5, 6] : null,
        cue: "",
        deadline: null,
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
            structure: goal.structure,
            days: goal.days,
            cue: goal.cue,
            deadline: goal.deadline,
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
      setState((s) => {
        const habitCompletions = { ...s.habitCompletions };
        delete habitCompletions[goalId];
        return {
          ...s,
          goals: s.goals.filter((g) => g.id !== goalId),
          milestones: s.milestones.filter((m) => m.goalId !== goalId),
          edges: s.edges.filter((edge) => edge.goalId !== goalId),
          habitCompletions,
        };
      });
      const sb = getSupabase();
      if (sb && user) {
        // milestones cascade in the database
        sb.from("goals").delete().eq("id", goalId).then(logError("delete goal"));
      }
    },
    [user]
  );

  const addMilestone = useCallback(
    (goalId: string, title: string, parentId: string | null = null) => {
      const position =
        Math.max(
          0,
          ...state.milestones
            .filter((m) => m.goalId === goalId && m.parentId === parentId)
            .map((m) => m.position)
        ) + 1;
      const milestone: Milestone = {
        id: crypto.randomUUID(),
        goalId,
        parentId,
        title: title.trim(),
        position,
        x: null,
        y: null,
        loopTarget: null,
        loopCount: 0,
        loopLast: null,
        hookSourceId: null,
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
            parent_id: milestone.parentId,
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

  const addSampleGoals = useCallback(() => {
    const nowIso = new Date().toISOString();
    const goals: Goal[] = [];
    const milestones: Milestone[] = [];

    const mkGoal = (title: string, structure: GoalStructure): Goal => {
      const goal: Goal = {
        id: crypto.randomUUID(),
        identity: title,
        why: "",
        structure,
        days: null,
        cue: "",
        deadline: null,
        createdAt: nowIso,
      };
      goals.push(goal);
      return goal;
    };
    const mkMilestone = (
      goal: Goal,
      title: string,
      position: number,
      done = false,
      parent: Milestone | null = null
    ): Milestone => {
      const milestone: Milestone = {
        id: crypto.randomUUID(),
        goalId: goal.id,
        parentId: parent?.id ?? null,
        title,
        position,
        x: null,
        y: null,
        loopTarget: null,
        loopCount: 0,
        loopLast: null,
        hookSourceId: null,
        completedAt: done ? nowIso : null,
        createdAt: nowIso,
      };
      milestones.push(milestone);
      return milestone;
    };

    // linear: a straight climb, two levels already cleared
    const marathon = mkGoal("Run a marathon", "linear");
    mkMilestone(marathon, "Run 1 mile without stopping", 1, true);
    mkMilestone(marathon, "Finish a 5k", 2, true);
    mkMilestone(marathon, "Finish a 10k", 3);
    mkMilestone(marathon, "Run a half marathon", 4);
    mkMilestone(marathon, "Run a full marathon", 5);

    // pyramid: three big pieces with sub-goals; the base is mostly built
    const business = mkGoal("Launch a small business", "pyramid");
    const product = mkMilestone(business, "Build the product", 1);
    const customers = mkMilestone(business, "Find customers", 2);
    const profit = mkMilestone(business, "Reach profitability", 3);
    mkMilestone(business, "Pick one painful problem", 1, true, product);
    mkMilestone(business, "Ship a first version", 2, true, product);
    mkMilestone(business, "Talk to 10 potential users", 1, true, customers);
    mkMilestone(business, "Land 3 paying customers", 2, false, customers);
    mkMilestone(business, "Cover monthly costs", 1, false, profit);
    mkMilestone(business, "Pay yourself $1k/month", 2, false, profit);

    // tree: completing a node unlocks the branches above it
    const guitar = mkGoal("Learn guitar", "tree");
    const chords = mkMilestone(guitar, "Learn 4 basic chords", 1, true);
    const song = mkMilestone(guitar, "Play a full song", 1, true, chords);
    const finger = mkMilestone(guitar, "Learn fingerpicking", 2, false, chords);
    mkMilestone(guitar, "Perform for a friend", 1, false, song);
    mkMilestone(guitar, "Learn barre chords", 2, false, song);
    mkMilestone(guitar, "Fingerpick a full song", 1, false, finger);

    setState((s) => ({
      ...s,
      goals: [...s.goals, ...goals],
      milestones: [...s.milestones, ...milestones],
    }));

    const sb = getSupabase();
    if (sb && user) {
      sb.from("goals")
        .insert(
          goals.map((g) => ({
            id: g.id,
            user_id: user.id,
            identity: g.identity,
            why: g.why,
            structure: g.structure,
            days: g.days,
            cue: g.cue,
            deadline: g.deadline,
            created_at: g.createdAt,
          }))
        )
        .then(({ error }) => {
          if (error) {
            console.error("supabase sample goals:", error.message);
            return;
          }
          sb.from("milestones")
            .insert(
              milestones.map((m) => ({
                id: m.id,
                user_id: user.id,
                goal_id: m.goalId,
                parent_id: m.parentId,
                title: m.title,
                position: m.position,
                completed_at: m.completedAt,
                created_at: m.createdAt,
              }))
            )
            .then(logError("sample milestones"));
        });
    }
  }, [user]);

  // completes a milestone plus everything hooked to it, transitively
  const completeCascade = useCallback(
    (milestoneId: string) => {
      const now = new Date().toISOString();
      const completedIds = new Set<string>([milestoneId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const m of state.milestones) {
          if (
            m.hookSourceId &&
            completedIds.has(m.hookSourceId) &&
            !m.completedAt &&
            !completedIds.has(m.id)
          ) {
            completedIds.add(m.id);
            grew = true;
          }
        }
      }
      setState((s) => ({
        ...s,
        milestones: s.milestones.map((m) =>
          completedIds.has(m.id) && !m.completedAt
            ? { ...m, completedAt: now }
            : m
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .update({ completed_at: now })
          .in("id", [...completedIds])
          .then(logError("complete milestones"));
      }
    },
    [user, state.milestones]
  );

  const toggleMilestone = useCallback(
    (milestoneId: string) => {
      const target = state.milestones.find((m) => m.id === milestoneId);
      if (!target) return;
      if (!target.completedAt) {
        completeCascade(milestoneId);
        return;
      }
      setState((s) => ({
        ...s,
        milestones: s.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completedAt: null } : m
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .update({ completed_at: null })
          .eq("id", milestoneId)
          .then(logError("toggle milestone"));
      }
    },
    [user, state.milestones, completeCascade]
  );

  const addMachineNode = useCallback(
    (goalId: string, title: string, x: number, y: number) => {
      const position =
        state.milestones.filter((m) => m.goalId === goalId).length + 1;
      const milestone: Milestone = {
        id: crypto.randomUUID(),
        goalId,
        parentId: null,
        title: title.trim(),
        position,
        x,
        y,
        loopTarget: null,
        loopCount: 0,
        loopLast: null,
        hookSourceId: null,
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
            goal_id: goalId,
            parent_id: null,
            title: milestone.title,
            position,
            pos_x: x,
            pos_y: y,
            completed_at: null,
            created_at: milestone.createdAt,
          })
          .then(logError("add machine node"));
      }
    },
    [user, state.milestones]
  );

  const moveNode = useCallback(
    (milestoneId: string, x: number, y: number) => {
      setState((s) => ({
        ...s,
        milestones: s.milestones.map((m) =>
          m.id === milestoneId ? { ...m, x, y } : m
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .update({ pos_x: x, pos_y: y })
          .eq("id", milestoneId)
          .then(logError("move node"));
      }
    },
    [user]
  );

  const addEdge = useCallback(
    (goalId: string, fromId: string, toId: string) => {
      if (fromId === toId) return;
      if (
        state.edges.some((e) => e.fromId === fromId && e.toId === toId)
      )
        return;
      const edge: MachineEdge = {
        id: crypto.randomUUID(),
        goalId,
        fromId,
        toId,
      };
      setState((s) => ({ ...s, edges: [...s.edges, edge] }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("machine_edges")
          .insert({
            id: edge.id,
            user_id: user.id,
            goal_id: goalId,
            from_id: fromId,
            to_id: toId,
          })
          .then(logError("add edge"));
      }
    },
    [user, state.edges]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setState((s) => ({
        ...s,
        edges: s.edges.filter((e) => e.id !== edgeId),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("machine_edges")
          .delete()
          .eq("id", edgeId)
          .then(logError("delete edge"));
      }
    },
    [user]
  );

  const setLoop = useCallback(
    (milestoneId: string, target: number | null) => {
      setState((s) => ({
        ...s,
        milestones: s.milestones.map((m) =>
          m.id === milestoneId ? { ...m, loopTarget: target } : m
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .update({ loop_target: target })
          .eq("id", milestoneId)
          .then(logError("set loop"));
      }
    },
    [user]
  );

  const tapLoop = useCallback(
    (milestoneId: string) => {
      const target = state.milestones.find((m) => m.id === milestoneId);
      if (!target || !target.loopTarget || target.completedAt) return;
      const today = todayKey();
      if (target.loopLast === today) return; // one rep per day
      const count = target.loopCount + 1;
      const finished = count >= target.loopTarget;
      setState((s) => ({
        ...s,
        milestones: s.milestones.map((m) =>
          m.id === milestoneId
            ? { ...m, loopCount: count, loopLast: today }
            : m
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .update({ loop_count: count, loop_last: today })
          .eq("id", milestoneId)
          .then(logError("tap loop"));
      }
      if (finished) completeCascade(milestoneId);
    },
    [user, state.milestones, completeCascade]
  );

  const setHook = useCallback(
    (milestoneId: string, sourceId: string | null) => {
      if (sourceId === milestoneId) return;
      setState((s) => ({
        ...s,
        milestones: s.milestones.map((m) =>
          m.id === milestoneId ? { ...m, hookSourceId: sourceId } : m
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .update({ hook_source_id: sourceId })
          .eq("id", milestoneId)
          .then(logError("set hook"));
      }
    },
    [user]
  );

  const deleteMilestone = useCallback(
    (milestoneId: string) => {
      setState((s) => {
        // remove the node and all descendants (the database cascades via parent_id)
        const doomed = new Set([milestoneId]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const m of s.milestones) {
            if (m.parentId && doomed.has(m.parentId) && !doomed.has(m.id)) {
              doomed.add(m.id);
              grew = true;
            }
          }
        }
        return {
          ...s,
          milestones: s.milestones
            .filter((m) => !doomed.has(m.id))
            .map((m) =>
              m.hookSourceId && doomed.has(m.hookSourceId)
                ? { ...m, hookSourceId: null }
                : m
            ),
          edges: s.edges.filter(
            (e) => !doomed.has(e.fromId) && !doomed.has(e.toId)
          ),
        };
      });
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

  const publishGoal = useCallback(
    async (goalId: string): Promise<string | null> => {
      const sb = getSupabase();
      if (!sb || !user) return "Sign in to publish to the library.";
      const goal = state.goals.find((g) => g.id === goalId);
      if (!goal) return "Goal not found.";
      const nodes = state.milestones.filter((m) => m.goalId === goalId);
      if (nodes.length === 0 && goal.structure !== "habit")
        return "Add some milestones before publishing.";

      const body: TemplateBundle = {
        goals: [
          {
            key: "g1",
            title: goal.identity,
            structure: goal.structure,
            days: goal.days,
            cue: goal.cue,
            nodes: nodes.map((m) => ({
              key: m.id,
              parent: m.parentId,
              title: m.title,
              x: m.x,
              y: m.y,
              loop: m.loopTarget,
            })),
            edges: state.edges
              .filter((e) => e.goalId === goalId)
              .map((e) => [e.fromId, e.toId] as [string, string]),
          },
        ],
      };
      const { error } = await sb.from("goal_templates").insert({
        id: crypto.randomUUID(),
        author_id: user.id,
        title: goal.identity,
        structure: goal.structure,
        body,
      });
      return error ? error.message : null;
    },
    [user, state.goals, state.milestones, state.edges]
  );

  const updateGoalTitle = useCallback(
    (goalId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      setState((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === goalId ? { ...g, identity: trimmed } : g
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("goals")
          .update({ identity: trimmed })
          .eq("id", goalId)
          .then(logError("rename goal"));
      }
    },
    [user]
  );

  const updateMilestoneTitle = useCallback(
    (milestoneId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      setState((s) => ({
        ...s,
        milestones: s.milestones.map((m) =>
          m.id === milestoneId ? { ...m, title: trimmed } : m
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("milestones")
          .update({ title: trimmed })
          .eq("id", milestoneId)
          .then(logError("rename milestone"));
      }
    },
    [user]
  );

  const importBundle = useCallback(
    (bundle: TemplateBundle): { error: string | null; goalId?: string } => {
      const count = bundle.goals.length;
      if (!state.pro && state.goals.length + count > FREE_GOAL_LIMIT) {
        return {
          error: `This template creates ${count} goal${count > 1 ? "s" : ""} and the free plan holds ${FREE_GOAL_LIMIT} — go Pro for unlimited goals.`,
        };
      }
      const nowIso = new Date().toISOString();
      const goals: Goal[] = [];
      const milestones: Milestone[] = [];
      const edges: MachineEdge[] = [];
      const nodeId = new Map<string, string>();

      for (const part of bundle.goals) {
        const goal: Goal = {
          id: crypto.randomUUID(),
          identity: part.title,
          why: "",
          structure: part.structure,
          days:
            part.structure === "habit"
              ? (part.days ?? [0, 1, 2, 3, 4, 5, 6])
              : null,
          cue: part.cue ?? "",
          deadline: null,
          createdAt: nowIso,
        };
        goals.push(goal);
        (part.nodes ?? []).forEach((n, idx) => {
          const mid = crypto.randomUUID();
          nodeId.set(`${part.key}.${n.key}`, mid);
          milestones.push({
            id: mid,
            goalId: goal.id,
            parentId: null,
            title: n.title,
            position: idx + 1,
            x: n.x ?? null,
            y: n.y ?? null,
            loopTarget: n.loop ?? null,
            loopCount: 0,
            loopLast: null,
            hookSourceId: null,
            completedAt: null,
            createdAt: nowIso,
          });
        });
      }
      bundle.goals.forEach((part, gi) => {
        (part.nodes ?? []).forEach((n) => {
          const m = milestones.find(
            (mm) => mm.id === nodeId.get(`${part.key}.${n.key}`)
          )!;
          if (n.parent)
            m.parentId = nodeId.get(`${part.key}.${n.parent}`) ?? null;
          if (n.hook) {
            const ref = n.hook.includes(".") ? n.hook : `${part.key}.${n.hook}`;
            m.hookSourceId = nodeId.get(ref) ?? null;
          }
        });
        (part.edges ?? []).forEach(([from, to]) => {
          const fromId = nodeId.get(`${part.key}.${from}`);
          const toId = nodeId.get(`${part.key}.${to}`);
          if (fromId && toId) {
            edges.push({
              id: crypto.randomUUID(),
              goalId: goals[gi].id,
              fromId,
              toId,
            });
          }
        });
      });

      setState((s) => ({
        ...s,
        goals: [...s.goals, ...goals],
        milestones: [...s.milestones, ...milestones],
        edges: [...s.edges, ...edges],
      }));

      const sb = getSupabase();
      if (sb && user) {
        sb.from("goals")
          .insert(
            goals.map((g) => ({
              id: g.id,
              user_id: user.id,
              identity: g.identity,
              why: g.why,
              structure: g.structure,
              days: g.days,
              cue: g.cue,
              deadline: g.deadline,
              created_at: g.createdAt,
            }))
          )
          .then(({ error }) => {
            if (error) {
              console.error("supabase import goals:", error.message);
              return;
            }
            sb.from("milestones")
              .insert(
                milestones.map((m) => ({
                  id: m.id,
                  user_id: user.id,
                  goal_id: m.goalId,
                  parent_id: m.parentId,
                  title: m.title,
                  position: m.position,
                  pos_x: m.x,
                  pos_y: m.y,
                  loop_target: m.loopTarget,
                  hook_source_id: m.hookSourceId,
                  completed_at: null,
                  created_at: m.createdAt,
                }))
              )
              .then(({ error: msError }) => {
                if (msError) {
                  console.error("supabase import milestones:", msError.message);
                  return;
                }
                if (edges.length > 0) {
                  sb.from("machine_edges")
                    .insert(
                      edges.map((edge) => ({
                        id: edge.id,
                        user_id: user.id,
                        goal_id: edge.goalId,
                        from_id: edge.fromId,
                        to_id: edge.toId,
                      }))
                    )
                    .then(logError("import edges"));
                }
              });
          });
      }
      return { error: null, goalId: goals[0]?.id };
    },
    [user, state.pro, state.goals.length]
  );

  const toggleHabitToday = useCallback(
    (goalId: string) => {
      const key = todayKey();
      const dates = state.habitCompletions[goalId] ?? [];
      const added = !dates.includes(key);
      setState((s) => {
        const current = s.habitCompletions[goalId] ?? [];
        const next = added
          ? [...current, key]
          : current.filter((d) => d !== key);
        return {
          ...s,
          habitCompletions: { ...s.habitCompletions, [goalId]: next },
        };
      });
      const sb = getSupabase();
      if (sb && user) {
        if (added) {
          sb.from("habit_completions")
            .upsert({ goal_id: goalId, user_id: user.id, date: key })
            .then(logError("complete habit"));
        } else {
          sb.from("habit_completions")
            .delete()
            .eq("goal_id", goalId)
            .eq("date", key)
            .then(logError("uncomplete habit"));
        }
      }
    },
    [user, state.habitCompletions]
  );

  const updateHabitConfig = useCallback(
    (goalId: string, days: number[], cue: string) => {
      const sorted = [...days].sort();
      setState((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === goalId ? { ...g, days: sorted, cue: cue.trim() } : g
        ),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("goals")
          .update({ days: sorted, cue: cue.trim() })
          .eq("id", goalId)
          .then(logError("update habit"));
      }
    },
    [user]
  );

  const updateGoalDeadline = useCallback(
    (goalId: string, deadline: string | null) => {
      setState((s) => ({
        ...s,
        goals: s.goals.map((g) => (g.id === goalId ? { ...g, deadline } : g)),
      }));
      const sb = getSupabase();
      if (sb && user) {
        sb.from("goals")
          .update({ deadline })
          .eq("id", goalId)
          .then(logError("update deadline"));
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
    if (!sb)
      return { error: "Accounts are not configured yet.", needsConfirmation: false };
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      // the confirmation link lands back on the account page, where the
      // client picks up the session automatically
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
    if (error) return { error: error.message, needsConfirmation: false };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const sb = getSupabase();
    if (!sb) return "Accounts are not configured yet.";
    const { error } = await sb.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
    return error ? error.message : null;
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
        addSampleGoals,
        toggleHabitToday,
        updateHabitConfig,
        updateGoalDeadline,
        addMachineNode,
        moveNode,
        addEdge,
        deleteEdge,
        setLoop,
        tapLoop,
        setHook,
        toggleMilestone,
        deleteMilestone,
        publishGoal,
        updateGoalTitle,
        updateMilestoneTitle,
        importBundle,
        refreshPro,
        signUp,
        resendConfirmation,
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
