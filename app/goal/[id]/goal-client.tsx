"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { Goal, Milestone } from "@/lib/types";
import { DAY_LABELS, isDueOn, todayKey } from "@/lib/dates";
import { currentStreak, completionRate } from "@/lib/habits";

function MilestoneInput({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd(title);
        setTitle("");
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        className="w-full flex-1 rounded-lg border border-gray-600 bg-navy-900 px-3 py-2 text-sm outline-none focus:border-gold-500"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className="shrink-0 rounded-lg bg-gold-500 px-3 py-2 text-sm font-medium text-ongold hover:bg-gold-400 disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}

/* ---------- Linear: a climb from bottom to top ---------- */

function LinearPath({
  goal,
  milestones,
}: {
  goal: Goal;
  milestones: Milestone[];
}) {
  const { addMilestone, toggleMilestone, deleteMilestone, updateMilestoneTitle } =
    useApp();
  const currentId = milestones.find((m) => !m.completedAt)?.id;
  // summit first: the latest milestone renders at the top, the start at the bottom
  const climb = [...milestones].reverse();

  return (
    <>
      <div className="mt-6">
        <MilestoneInput
          placeholder={
            milestones.length === 0 ? "Save my first $1,000" : "Next level up…"
          }
          onAdd={(t) => addMilestone(goal.id, t)}
        />
        <p className="mt-1.5 text-xs text-gray-500">
          New milestones stack on top — the climb starts at the bottom.
        </p>
      </div>
      <ol className="relative mt-4 space-y-1">
        {climb.map((milestone, j) => {
          const completed = Boolean(milestone.completedAt);
          const isCurrent = milestone.id === currentId;
          const below = climb[j + 1]; // the milestone beneath this one
          const number = milestones.length - j;
          return (
            <li key={milestone.id} className="relative flex gap-4">
              {below && (
                <span
                  aria-hidden
                  className={`absolute left-6 top-12 h-[calc(100%-2.5rem)] w-0.5 -translate-x-1/2 ${
                    below.completedAt
                      ? "bg-gold-500"
                      : "bg-navy-700"
                  }`}
                />
              )}
              <button
                onClick={() => toggleMilestone(milestone.id)}
                aria-label={`${completed ? "Un-complete" : "Complete"} ${milestone.title}`}
                className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                  completed
                    ? "border-gold-400 bg-gold-500 text-ongold"
                    : isCurrent
                      ? "border-gray-100 bg-navy-900 text-gray-100 ring-4 ring-gold-700"
                      : "border-gray-600 bg-navy-900 text-gray-500"
                }`}
              >
                {completed ? "✓" : number}
              </button>
              <div
                className={`flex min-w-0 flex-1 items-center justify-between gap-2 pb-8 pt-3 ${
                  !completed && !isCurrent ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className={completed ? "line-through opacity-70" : ""}>
                    {milestone.title}
                  </p>
                  {isCurrent && (
                    <p className="text-xs font-medium text-gold-400">
                      Current level
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    const next = prompt("Rename milestone:", milestone.title);
                    if (next) updateMilestoneTitle(milestone.id, next);
                  }}
                  aria-label={`Rename ${milestone.title}`}
                  className="shrink-0 p-1 text-gray-500 hover:text-gray-200"
                >
                  ✎
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${milestone.title}"?`))
                      deleteMilestone(milestone.id);
                  }}
                  aria-label={`Delete ${milestone.title}`}
                  className="shrink-0 p-1 text-gray-500 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/* ---------- Pyramid & Tree: a 2D map, climbing upward ---------- */

const NODE_R = 24;
const SLOT_W = 124;
const LEVEL_H = 122;
const PAD_X = 68;
const PAD_Y = 38;
const LABEL_H = 66;

/** wrap a node label into whole-word lines that fit under the bubble */
function wrapLabel(title: string, maxChars = 16, maxLines = 3): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] += "…";
    return kept;
  }
  return lines;
}

function GraphView({
  goal,
  milestones,
}: {
  goal: Goal;
  milestones: Milestone[];
}) {
  const { addMilestone, toggleMilestone, deleteMilestone, updateMilestoneTitle } =
    useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [branching, setBranching] = useState(false);
  const isPyramid = goal.structure === "pyramid";

  const byId = new Map(milestones.map((m) => [m.id, m]));
  const childrenOf = (parentId: string | null) =>
    milestones
      .filter((m) => m.parentId === parentId)
      .sort((a, b) => a.position - b.position);

  // pyramid: a parent is locked until all of its sub-goals are done
  // tree: a child is locked until its parent is done
  const isLocked = (m: Milestone) =>
    isPyramid
      ? childrenOf(m.id).some((c) => !c.completedAt)
      : m.parentId !== null && !byId.get(m.parentId)?.completedAt;

  // tidy-tree layout: leaves claim slots left to right, parents center over
  // children; y is assigned afterwards so both modes climb toward the top
  const xs = new Map<string, number>();
  const depths = new Map<string, number>();
  let leafCount = 0;
  let maxDepth = 0;
  const layout = (node: Milestone, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    depths.set(node.id, depth);
    const kids = childrenOf(node.id);
    let x: number;
    if (kids.length === 0) {
      x = leafCount++ * SLOT_W;
    } else {
      const kidXs = kids.map((k) => layout(k, depth + 1));
      x = (Math.min(...kidXs) + Math.max(...kidXs)) / 2;
    }
    xs.set(node.id, x + PAD_X);
    return x;
  };
  childrenOf(null).forEach((root) => layout(root, 0));

  // pyramid apex (depth 0) sits at the top, its base at the bottom;
  // tree roots (depth 0) sit at the bottom and growth climbs upward
  const yOf = (id: string) => {
    const depth = depths.get(id) ?? 0;
    const level = isPyramid ? depth : maxDepth - depth;
    return level * LEVEL_H + PAD_Y;
  };
  const pos = new Map<string, { x: number; y: number }>();
  for (const m of milestones) {
    const x = xs.get(m.id);
    if (x !== undefined) pos.set(m.id, { x, y: yOf(m.id) });
  }

  const width = Math.max((leafCount - 1) * SLOT_W + PAD_X * 2, 280);
  const height = maxDepth * LEVEL_H + PAD_Y + NODE_R + LABEL_H;

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const select = (id: string | null) => {
    setSelectedId(id);
    setBranching(false);
  };

  const lockedReason = (m: Milestone) =>
    isPyramid
      ? "Locked — finish its sub-goals first"
      : `Locked — complete "${byId.get(m.parentId!)?.title}" first`;

  return (
    <>
      {milestones.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-700 bg-navy-900">
          <svg width={width} height={height} className="block">
            {/* edges */}
            {milestones.map((m) => {
              if (!m.parentId) return null;
              const from = pos.get(m.parentId);
              const to = pos.get(m.id);
              if (!from || !to) return null;
              const dir = to.y > from.y ? 1 : -1;
              const startY = from.y + dir * NODE_R;
              const endY = to.y - dir * NODE_R;
              const midY = (startY + endY) / 2;
              const gated = isPyramid ? byId.get(m.parentId)! : m;
              return (
                <path
                  key={`edge-${m.id}`}
                  d={`M ${from.x} ${startY} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${endY}`}
                  fill="none"
                  strokeWidth={2.5}
                  className={
                    gated.completedAt
                      ? "stroke-gold-500"
                      : isLocked(gated)
                        ? "stroke-gray-700"
                        : "stroke-gray-500"
                  }
                />
              );
            })}
            {/* nodes */}
            {milestones.map((m) => {
              const p = pos.get(m.id);
              if (!p) return null;
              const completed = Boolean(m.completedAt);
              const locked = isLocked(m);
              const isSelected = m.id === selectedId;
              return (
                <g
                  key={m.id}
                  onClick={() => select(isSelected ? null : m.id)}
                  className="cursor-pointer"
                >
                  {isSelected && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={NODE_R + 6}
                      className="fill-none stroke-sky-400"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={NODE_R}
                    strokeWidth={2.5}
                    className={
                      completed
                        ? "fill-gold-500 stroke-gold-400"
                        : locked
                          ? "fill-navy-800 stroke-gray-600"
                          : "fill-navy-900 stroke-gray-100"
                    }
                  />
                  <text
                    x={p.x}
                    y={p.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={completed || locked ? 15 : 17}
                    className={
                      completed
                        ? "fill-ongold font-bold"
                        : locked
                          ? "fill-gray-500"
                          : "fill-gray-100 font-bold"
                    }
                  >
                    {completed ? "✓" : locked ? "🔒" : "○"}
                  </text>
                  <text
                    x={p.x}
                    y={p.y + NODE_R + 18}
                    textAnchor="middle"
                    fontSize={13}
                    className={`${
                      locked
                        ? "fill-gray-500"
                        : "fill-gray-200"
                    } select-none`}
                  >
                    {wrapLabel(m.title).map((line, li) => (
                      <tspan key={li} x={p.x} dy={li === 0 ? 0 : 15}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {selected ? (
        <div className="mt-3 rounded-xl border border-sky-700 bg-navy-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{selected.title}</p>
              <p className="text-xs text-gray-400">
                {selected.completedAt
                  ? "Completed"
                  : isLocked(selected)
                    ? lockedReason(selected)
                    : "Ready to complete"}
              </p>
            </div>
            <button
              onClick={() => select(null)}
              aria-label="Close"
              className="shrink-0 p-1 text-gray-500 hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => toggleMilestone(selected.id)}
              disabled={isLocked(selected)}
              className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-medium text-ongold hover:bg-gold-400 disabled:opacity-40"
            >
              {selected.completedAt ? "Undo complete" : "✓ Complete"}
            </button>
            <button
              onClick={() => setBranching(!branching)}
              className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-navy-800"
            >
              {isPyramid ? "＋ Sub-goal" : "＋ Branch"}
            </button>
            <button
              onClick={() => {
                const next = prompt("Rename:", selected.title);
                if (next) updateMilestoneTitle(selected.id, next);
              }}
              className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm hover:bg-navy-800"
            >
              ✎ Rename
            </button>
            <button
              onClick={() => {
                const kids = childrenOf(selected.id).length;
                const warning =
                  kids > 0
                    ? `Delete "${selected.title}" and everything under it?`
                    : `Delete "${selected.title}"?`;
                if (confirm(warning)) {
                  deleteMilestone(selected.id);
                  select(null);
                }
              }}
              className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-400 hover:text-red-600"
            >
              Delete
            </button>
          </div>
          <HookEditor milestone={selected} />
          {branching && (
            <div className="mt-3">
              <MilestoneInput
                placeholder={
                  isPyramid ? "Sub-goal beneath this…" : "What does this unlock?"
                }
                onAdd={(t) => {
                  addMilestone(goal.id, t, selected.id);
                  setBranching(false);
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <MilestoneInput
            placeholder={
              milestones.length === 0
                ? isPyramid
                  ? "First big piece of this goal…"
                  : "First goal on the map…"
                : isPyramid
                  ? "Another big piece…"
                  : "Another starting goal…"
            }
            onAdd={(t) => addMilestone(goal.id, t, null)}
          />
          <p className="mt-2 text-xs text-gray-500">
            {isPyramid
              ? "Tap a node to break it into sub-goals below it. Parents unlock when everything beneath them is done — build from the base up."
              : "Tap a node to complete it or branch upward from it. Locked nodes open when the node beneath them is done."}
          </p>
        </div>
      )}
    </>
  );
}

/* ---------- Habit: weekly schedule, streaks, and a stacking cue ---------- */

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function HabitView({ goal }: { goal: Goal }) {
  const { state, toggleHabitToday, updateHabitConfig } = useApp();
  const [cueDraft, setCueDraft] = useState(goal.cue);

  const dates = state.habitCompletions[goal.id] ?? [];
  const days = goal.days ?? ALL_DAYS;
  const scheduledToday = isDueOn(days, new Date());
  const doneToday = dates.includes(todayKey());
  const streak = currentStreak(days, dates, goal.createdAt);
  const rate = completionRate(days, dates, goal.createdAt);

  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    if (next.length === 0) return; // a habit needs at least one scheduled day
    updateHabitConfig(goal.id, next, goal.cue);
  };

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-xl border border-gray-700 bg-navy-900 p-6 text-center">
        {scheduledToday ? (
          <>
            <button
              onClick={() => toggleHabitToday(goal.id)}
              aria-label={doneToday ? "Un-complete today" : "Complete today"}
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 text-3xl font-bold transition ${
                doneToday
                  ? "border-gold-400 bg-gold-500 text-ongold"
                  : "border-gray-100 bg-navy-950 text-gray-100 hover:border-gold-400"
              }`}
            >
              {doneToday ? "✓" : "○"}
            </button>
            <p className="mt-3 font-medium">
              {doneToday ? "Done today" : "Tap when it's done"}
            </p>
          </>
        ) : (
          <p className="text-gray-400">Rest day — nothing scheduled today.</p>
        )}
        <p className="mt-2 text-sm text-gray-400">
          {streak > 0 ? `🔥 ${streak}-day streak` : "Start your streak today"}
          {rate !== null && <> · {rate}% of scheduled days in the last month</>}
        </p>
      </div>

      <form
        className="rounded-xl border border-gray-700 bg-navy-900 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          updateHabitConfig(goal.id, days, cueDraft.replace(/^after\s+/i, ""));
        }}
      >
        <p className="text-sm font-medium">Stack it after a routine</p>
        {goal.cue && (
          <p className="mt-1 text-sm text-gold-300">
            After {goal.cue}, I will {goal.identity}.
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <input
            value={cueDraft}
            onChange={(e) => setCueDraft(e.target.value)}
            placeholder="after I pour my morning coffee (optional)"
            className="w-full flex-1 rounded-lg border border-gray-600 bg-navy-950 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
          {cueDraft.replace(/^after\s+/i, "").trim() !== goal.cue && (
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-gold-500 px-3 py-2 text-sm font-medium text-ongold hover:bg-gold-400"
            >
              Save
            </button>
          )}
        </div>
      </form>

      <div className="rounded-xl border border-gray-700 bg-navy-900 p-4">
        <p className="text-sm font-medium">Scheduled days</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ALL_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                days.includes(d)
                  ? "bg-gold-500 text-ongold"
                  : "bg-navy-700 text-gray-300"
              }`}
            >
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Streaks count consecutive scheduled days — rest days never break them.
        </p>
      </div>
    </div>
  );
}


/* ---------- Machine (Pro): drag-and-drop process map ---------- */

const M_W = 128;
const M_H = 48;
const CANVAS_W = 1000;
const CANVAS_H = 760;

function HookEditor({ milestone }: { milestone: Milestone }) {
  const { state, setHook, setHabitHook } = useApp();
  const [goalId, setGoalId] = useState("");
  const [reps, setReps] = useState(30);

  if (!state.pro) {
    return (
      <p className="mt-3 border-t border-gray-700 pt-3 text-xs">
        <Link href="/upgrade" className="text-gold-400 underline">
          ⚡ Hook steps across goals with Pro
        </Link>
      </p>
    );
  }

  const source = milestone.hookSourceId
    ? state.milestones.find((m) => m.id === milestone.hookSourceId)
    : null;
  const sourceGoal = source
    ? state.goals.find((g) => g.id === source.goalId)
    : null;
  const habitGoal = milestone.hookGoalId
    ? state.goals.find((g) => g.id === milestone.hookGoalId)
    : null;
  const habitDone = habitGoal
    ? (state.habitCompletions[habitGoal.id] ?? []).length
    : 0;

  // habits hook by repetitions; every other goal hooks step-to-step
  const otherGoals = state.goals.filter((g) => g.id !== milestone.goalId);
  const picked = goalId ? state.goals.find((g) => g.id === goalId) : null;
  const pickedSteps = picked
    ? state.milestones.filter((m) => m.goalId === picked.id && m.id !== milestone.id)
    : [];

  const clear = () => {
    setHook(milestone.id, null);
    setHabitHook(milestone.id, null, null);
    setGoalId("");
  };

  return (
    <div className="mt-3 border-t border-gray-700 pt-3 text-sm">
      <p className="font-medium">⚡ Hook</p>
      {habitGoal ? (
        <p className="mt-1 text-gray-400">
          Auto-completes at {milestone.hookTarget} completions of the habit “
          {habitGoal.identity}” — {habitDone} done so far.{" "}
          <button onClick={clear} className="underline hover:text-gray-200">
            Remove
          </button>
        </p>
      ) : source ? (
        <p className="mt-1 text-gray-400">
          Auto-completes when “{source.title}”
          {sourceGoal && <> in {sourceGoal.identity}</>} is completed.{" "}
          <button onClick={clear} className="underline hover:text-gray-200">
            Remove
          </button>
        </p>
      ) : otherGoals.length === 0 ? (
        <p className="mt-1 text-xs text-gray-400">
          Create another goal or habit to hook into.
        </p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="rounded-md border border-gray-600 bg-navy-950 px-2 py-1.5 text-sm text-gray-100"
          >
            <option value="">Completes when… (pick a goal or habit)</option>
            {otherGoals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.structure === "habit" ? "↻ " : ""}
                {g.identity}
              </option>
            ))}
          </select>

          {picked?.structure === "habit" ? (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-gray-400">…is done</span>
              <input
                type="number"
                min={1}
                value={reps}
                onChange={(e) => setReps(Number(e.target.value))}
                className="w-20 rounded-md border border-gray-600 bg-navy-950 px-2 py-1.5 text-sm text-gray-100"
              />
              <span className="shrink-0 text-gray-400">times</span>
              <button
                onClick={() => {
                  setHabitHook(milestone.id, picked.id, reps);
                  setGoalId("");
                }}
                className="shrink-0 rounded-md bg-gold-500 px-3 py-1.5 text-sm font-medium text-ongold hover:bg-gold-400"
              >
                Hook
              </button>
            </div>
          ) : picked ? (
            pickedSteps.length === 0 ? (
              <p className="text-xs text-gray-400">
                “{picked.identity}” has no steps yet — add one to hook into it.
              </p>
            ) : (
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    setHook(milestone.id, e.target.value);
                    setGoalId("");
                  }
                }}
                className="rounded-md border border-gray-600 bg-navy-950 px-2 py-1.5 text-sm text-gray-100"
              >
                <option value="">…this step is completed:</option>
                {pickedSteps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

function MachineView({ goal }: { goal: Goal }) {
  const {
    state,
    addMachineNode,
    moveNode,
    addEdge,
    deleteEdge,
    setLoop,
    tapLoop,
    toggleMilestone,
    deleteMilestone,
    updateMilestoneTitle,
  } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [localPos, setLocalPos] = useState<Record<string, { x: number; y: number }>>({});
  const drag = useRef<{
    id: string;
    dx: number;
    dy: number;
    moved: boolean;
    lastX: number;
    lastY: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const nodes = state.milestones.filter((m) => m.goalId === goal.id);
  const edges = state.edges.filter((e) => e.goalId === goal.id);
  const byId = new Map(nodes.map((m) => [m.id, m]));

  const posOf = (m: Milestone, i: number) => {
    const local = localPos[m.id];
    if (local) return local;
    return {
      x: m.x ?? 90 + (i % 3) * 160,
      y: m.y ?? 70 + Math.floor(i / 3) * 110,
    };
  };
  const positions = new Map(nodes.map((m, i) => [m.id, posOf(m, i)]));

  const incoming = (id: string) => edges.filter((e) => e.toId === id);
  const isLocked = (m: Milestone) => {
    const inc = incoming(m.id);
    if (inc.length === 0) return false;
    return !inc.some((e) => byId.get(e.fromId)?.completedAt);
  };

  const svgPoint = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onNodePointerDown = (m: Milestone) => (e: React.PointerEvent) => {
    const p = svgPoint(e);
    const pos = positions.get(m.id)!;
    drag.current = {
      id: m.id,
      dx: p.x - pos.x,
      dy: p.y - pos.y,
      moved: false,
      lastX: pos.x,
      lastY: pos.y,
    };
    // keep receiving moves even if the finger leaves the svg
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // some browsers refuse capture on svg roots; drag still works without it
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const p = svgPoint(e);
    const x = Math.min(Math.max(p.x - d.dx, M_W / 2), CANVAS_W - M_W / 2);
    const y = Math.min(Math.max(p.y - d.dy, M_H / 2), CANVAS_H - M_H / 2);
    d.moved = true;
    d.lastX = x;
    d.lastY = y;
    const id = d.id; // captured: d may be cleared before the updater runs
    setLocalPos((lp) => ({ ...lp, [id]: { x, y } }));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      moveNode(d.id, d.lastX, d.lastY);
      return;
    }
    // a tap, not a drag
    if (connectFrom && connectFrom !== d.id) {
      addEdge(goal.id, connectFrom, d.id);
      setConnectFrom(null);
      return;
    }
    setSelectedEdgeId(null);
    setSelectedId(selectedId === d.id ? null : d.id);
  };
  // the browser can seize the gesture (e.g. to scroll) mid-drag; commit
  // whatever position we reached instead of crashing or losing the node
  const onPointerCancel = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) moveNode(d.id, d.lastX, d.lastY);
  };

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const selectedEdge = selectedEdgeId
    ? (edges.find((e) => e.id === selectedEdgeId) ?? null)
    : null;

  const addStep = () => {
    const title = prompt("Name this step:");
    if (!title || !title.trim()) return;
    const i = nodes.length;
    addMachineNode(
      goal.id,
      title,
      90 + (i % 3) * 160,
      70 + Math.floor(i / 3) * 110
    );
  };

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={addStep}
          className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-medium text-ongold hover:bg-gold-400"
        >
          ＋ Step
        </button>
        <button
          onClick={() => {
            setConnectFrom(connectFrom ? null : (selectedId ?? ""));
            if (!selectedId) setConnectFrom(null);
          }}
          disabled={!selectedId && !connectFrom}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
            connectFrom
              ? "border-gold-500 text-gold-400"
              : "border-gray-600 hover:bg-navy-800"
          }`}
        >
          {connectFrom ? "Tap a target step…" : "→ Connect from selected"}
        </button>
      </div>

      <div className="mt-3 overflow-auto rounded-xl border border-gray-700 bg-navy-900">
        <svg
          ref={svgRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <defs>
            <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" className="fill-navy-700" />
            </pattern>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-gray-500" />
            </marker>
            <marker
              id="arrow-gold"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-gold-500" />
            </marker>
          </defs>
          <rect width={CANVAS_W} height={CANVAS_H} fill="url(#dots)" />

          {edges.map((e) => {
            const from = positions.get(e.fromId);
            const to = positions.get(e.toId);
            if (!from || !to) return null;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.max(Math.hypot(dx, dy), 1);
            const trim = 78 / dist;
            const x1 = from.x + dx * trim * 0.55;
            const y1 = from.y + dy * trim * 0.55;
            const x2 = to.x - dx * trim * 0.55;
            const y2 = to.y - dy * trim * 0.55;
            const live = Boolean(byId.get(e.fromId)?.completedAt);
            const isSel = e.id === selectedEdgeId;
            return (
              <g key={e.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={isSel ? 3.5 : 2.5}
                  markerEnd={live ? "url(#arrow-gold)" : "url(#arrow)"}
                  className={
                    isSel
                      ? "stroke-sky-400"
                      : live
                        ? "stroke-gold-500"
                        : "stroke-gray-500"
                  }
                />
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={16}
                  stroke="transparent"
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedId(null);
                    setSelectedEdgeId(isSel ? null : e.id);
                  }}
                />
              </g>
            );
          })}

          {nodes.map((m, i) => {
            const p = positions.get(m.id)!;
            const completed = Boolean(m.completedAt);
            const locked = isLocked(m);
            const isSel = m.id === selectedId;
            const isConnectSource = m.id === connectFrom;
            void i;
            return (
              <g
                key={m.id}
                onPointerDown={onNodePointerDown(m)}
                style={{ touchAction: "none" }}
                className="cursor-pointer"
              >
                <rect
                  x={p.x - M_W / 2}
                  y={p.y - M_H / 2}
                  width={M_W}
                  height={M_H}
                  rx={10}
                  strokeWidth={2.5}
                  strokeDasharray={locked && !completed ? "5 4" : undefined}
                  className={
                    completed
                      ? "fill-gold-500 stroke-gold-400"
                      : locked
                        ? "fill-navy-800 stroke-gray-600"
                        : "fill-navy-950 stroke-gray-100"
                  }
                />
                {(isSel || isConnectSource) && (
                  <rect
                    x={p.x - M_W / 2 - 5}
                    y={p.y - M_H / 2 - 5}
                    width={M_W + 10}
                    height={M_H + 10}
                    rx={13}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    className={`fill-none ${
                      isConnectSource ? "stroke-gold-400" : "stroke-sky-400"
                    }`}
                  />
                )}
                <text
                  x={p.x}
                  y={p.y - (m.loopTarget || m.hookSourceId || m.hookGoalId ? 4 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={12.5}
                  className={`select-none ${
                    completed
                      ? "fill-ongold font-semibold"
                      : locked
                        ? "fill-gray-500"
                        : "fill-gray-100"
                  }`}
                >
                  {m.title.length > 17 ? `${m.title.slice(0, 16)}…` : m.title}
                </text>
                {(m.loopTarget || m.hookSourceId || m.hookGoalId) && (
                  <text
                    x={p.x}
                    y={p.y + 13}
                    textAnchor="middle"
                    fontSize={10}
                    className={completed ? "fill-ongold" : "fill-gold-400"}
                  >
                    {m.loopTarget ? `↻ ${m.loopCount}/${m.loopTarget}` : ""}
                    {m.loopTarget && (m.hookSourceId || m.hookGoalId) ? " " : ""}
                    {m.hookSourceId || m.hookGoalId ? "⚡" : ""}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {selectedEdge && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-sky-700 bg-navy-900 p-4 text-sm">
          <p className="min-w-0">
            Path: “{byId.get(selectedEdge.fromId)?.title}” →{" "}
            “{byId.get(selectedEdge.toId)?.title}”
          </p>
          <button
            onClick={() => {
              deleteEdge(selectedEdge.id);
              setSelectedEdgeId(null);
            }}
            className="shrink-0 rounded-lg border border-gray-600 px-3 py-1.5 text-gray-400 hover:text-red-500"
          >
            Delete path
          </button>
        </div>
      )}

      {selected ? (
        <div className="mt-3 rounded-xl border border-sky-700 bg-navy-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{selected.title}</p>
              <p className="text-xs text-gray-400">
                {selected.completedAt
                  ? "Completed"
                  : isLocked(selected)
                    ? "Locked — completes when any incoming path finishes"
                    : selected.loopTarget
                      ? `Loop: ${selected.loopCount}/${selected.loopTarget} reps (one per day)`
                      : "Ready"}
              </p>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="shrink-0 p-1 text-gray-500 hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.loopTarget && !selected.completedAt ? (
              <button
                onClick={() => tapLoop(selected.id)}
                disabled={isLocked(selected) || selected.loopLast === todayKey()}
                className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-medium text-ongold hover:bg-gold-400 disabled:opacity-40"
              >
                {selected.loopLast === todayKey()
                  ? "Counted today ✓"
                  : `↻ Count today's rep (${selected.loopCount}/${selected.loopTarget})`}
              </button>
            ) : (
              <button
                onClick={() => toggleMilestone(selected.id)}
                disabled={isLocked(selected) && !selected.completedAt}
                className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-medium text-ongold hover:bg-gold-400 disabled:opacity-40"
              >
                {selected.completedAt ? "Undo complete" : "✓ Complete"}
              </button>
            )}
            <button
              onClick={() => {
                setConnectFrom(selected.id);
              }}
              className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-navy-800"
            >
              → Connect
            </button>
            {selected.loopTarget ? (
              <button
                onClick={() => setLoop(selected.id, null)}
                className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm hover:bg-navy-800"
              >
                Remove loop
              </button>
            ) : (
              <button
                onClick={() => {
                  const raw = prompt("Loop: how many reps to complete it? (e.g. 7)");
                  const n = raw ? parseInt(raw, 10) : NaN;
                  if (!Number.isNaN(n) && n > 0) setLoop(selected.id, n);
                }}
                className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm hover:bg-navy-800"
              >
                ↻ Make loop
              </button>
            )}
            <button
              onClick={() => {
                const next = prompt("Rename step:", selected.title);
                if (next) updateMilestoneTitle(selected.id, next);
              }}
              className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm hover:bg-navy-800"
            >
              ✎ Rename
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete step "${selected.title}"?`)) {
                  deleteMilestone(selected.id);
                  setSelectedId(null);
                }
              }}
              className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-400 hover:text-red-500"
            >
              Delete
            </button>
          </div>
          <HookEditor milestone={selected} />
        </div>
      ) : (
        !selectedEdge && (
          <p className="mt-3 text-xs text-gray-400">
            ＋ Step adds a box. Drag boxes to arrange your process. Tap one,
            then “→ Connect”, then tap another to draw a path — a step unlocks
            when any path into it completes (Plan A or Plan B). Loops need
            daily reps before they open the next step.
          </p>
        )
      )}
    </>
  );
}

/* ---------- Page ---------- */

export default function GoalClient() {
  const { id } = useParams<{ id: string }>();
  const { state, ready, user, publishGoal, updateGoalDeadline, updateGoalTitle } =
    useApp();
  const [publishState, setPublishState] = useState<string | null>(null);

  if (!ready) return null;

  const goal = state.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-300">Goal not found.</p>
        <Link href="/" className="mt-3 inline-block underline">
          Back to goals
        </Link>
      </div>
    );
  }

  const milestones = state.milestones
    .filter((m) => m.goalId === goal.id)
    .sort((a, b) => a.position - b.position);
  const done = milestones.filter((m) => m.completedAt).length;

  return (
    <div>
      <Link href="/" className="text-sm text-gray-400 hover:underline">
        ← Goals
      </Link>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {goal.identity}{" "}
          <button
            onClick={() => {
              const next = prompt("Rename goal:", goal.identity);
              if (next) updateGoalTitle(goal.id, next);
            }}
            aria-label="Rename goal"
            className="align-middle text-base text-gray-500 hover:text-gray-200"
          >
            ✎
          </button>
        </h1>
        <span className="shrink-0 text-xs uppercase tracking-wide text-gray-500">
          {goal.structure}
        </span>
      </div>
      {milestones.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-800">
            <div
              className="h-full rounded-full bg-gold-500 transition-all"
              style={{ width: `${Math.round((done / milestones.length) * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-gray-400">
            {done}/{milestones.length}
          </span>
        </div>
      )}

      {goal.structure !== "habit" && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
          <label htmlFor="deadline">Deadline:</label>
          <input
            id="deadline"
            type="date"
            value={goal.deadline ?? ""}
            onChange={(e) => updateGoalDeadline(goal.id, e.target.value || null)}
            className="rounded-md border border-gray-600 bg-navy-900 px-2 py-1 text-sm text-gray-100 outline-none [color-scheme:dark]"
          />
          {goal.deadline ? (
            <button
              onClick={() => updateGoalDeadline(goal.id, null)}
              className="underline hover:text-gray-200"
            >
              clear
            </button>
          ) : (
            <span className="text-gray-500">optional</span>
          )}
        </div>
      )}

      {user && (milestones.length > 0 || goal.structure === "habit") && (
        <div className="mt-2">
          <button
            disabled={publishState !== null}
            onClick={async () => {
              setPublishState("publishing");
              const err = await publishGoal(goal.id);
              setPublishState(err ?? "done");
            }}
            className="text-sm text-gray-400 underline hover:text-gray-200 disabled:no-underline"
          >
            {publishState === null && "Share this structure to the library"}
            {publishState === "publishing" && "Publishing…"}
            {publishState === "done" && "Published to the library ✓"}
            {publishState !== null &&
              publishState !== "publishing" &&
              publishState !== "done" &&
              `Couldn't publish: ${publishState}`}
          </button>
        </div>
      )}

      {milestones.length === 0 && goal.structure !== "habit" && (
        <p className="mt-6 text-gray-300">
          {goal.structure === "linear" &&
            "Break this goal into milestones — the levels you'll climb on the way. Start with the first small win."}
          {goal.structure === "pyramid" &&
            "Big goals need many things to come together. Add the major pieces, break them into sub-goals, and build from the base up."}
          {goal.structure === "tree" &&
            "Map it like a skill tree: add starting goals at the base, and completing each unlocks what grows above it."}
          {goal.structure === "machine" &&
            "Design your machine: add steps, drag them into a process, and connect the paths that drive your goal."}
        </p>
      )}

      {goal.structure === "machine" ? (
        <MachineView goal={goal} />
      ) : goal.structure === "habit" ? (
        <HabitView goal={goal} />
      ) : goal.structure === "linear" ? (
        <LinearPath goal={goal} milestones={milestones} />
      ) : (
        <GraphView goal={goal} milestones={milestones} />
      )}
    </div>
  );
}
