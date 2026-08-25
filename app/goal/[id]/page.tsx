"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { Goal, Milestone } from "@/lib/types";

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
        className="shrink-0 rounded-lg bg-gold-500 px-3 py-2 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-40"
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
  const { addMilestone, toggleMilestone, deleteMilestone } = useApp();
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
                    ? "border-gold-400 bg-gold-500 text-navy-950"
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
                  onClick={() => deleteMilestone(milestone.id)}
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

const NODE_R = 22;
const SLOT_W = 96;
const LEVEL_H = 100;
const PAD_X = 56;
const PAD_Y = 36;
const LABEL_H = 48;

function GraphView({
  goal,
  milestones,
}: {
  goal: Goal;
  milestones: Milestone[];
}) {
  const { addMilestone, toggleMilestone, deleteMilestone } = useApp();
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
                        ? "fill-navy-950 font-bold"
                        : locked
                          ? "fill-gray-500"
                          : "fill-gray-100 font-bold"
                    }
                  >
                    {completed ? "✓" : locked ? "🔒" : "○"}
                  </text>
                  <text
                    x={p.x}
                    y={p.y + NODE_R + 16}
                    textAnchor="middle"
                    fontSize={11}
                    className={`${
                      locked
                        ? "fill-gray-500"
                        : "fill-gray-200"
                    } select-none`}
                  >
                    {m.title.length > 14 ? `${m.title.slice(0, 13)}…` : m.title}
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
              className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-40"
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
                const kids = childrenOf(selected.id).length;
                if (
                  kids === 0 ||
                  confirm(`Delete "${selected.title}" and everything under it?`)
                ) {
                  deleteMilestone(selected.id);
                  select(null);
                }
              }}
              className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-400 hover:text-red-600"
            >
              Delete
            </button>
          </div>
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

/* ---------- Page ---------- */

export default function GoalTreePage() {
  const { id } = useParams<{ id: string }>();
  const { state, ready } = useApp();

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
        <h1 className="text-2xl font-bold">{goal.identity}</h1>
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

      {milestones.length === 0 && (
        <p className="mt-6 text-gray-300">
          {goal.structure === "linear" &&
            "Break this goal into milestones — the levels you'll climb on the way. Start with the first small win."}
          {goal.structure === "pyramid" &&
            "Big goals need many things to come together. Add the major pieces, break them into sub-goals, and build from the base up."}
          {goal.structure === "tree" &&
            "Map it like a skill tree: add starting goals at the base, and completing each unlocks what grows above it."}
        </p>
      )}

      {goal.structure === "linear" ? (
        <LinearPath goal={goal} milestones={milestones} />
      ) : (
        <GraphView goal={goal} milestones={milestones} />
      )}
    </div>
  );
}
