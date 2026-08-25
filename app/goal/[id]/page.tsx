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
        className="w-full flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Add
      </button>
    </form>
  );
}

/* ---------- Linear: a straight level path ---------- */

function LinearPath({
  goal,
  milestones,
}: {
  goal: Goal;
  milestones: Milestone[];
}) {
  const { addMilestone, toggleMilestone, deleteMilestone } = useApp();
  const currentId = milestones.find((m) => !m.completedAt)?.id;

  return (
    <>
      <ol className="relative mt-6 space-y-1">
        {milestones.map((milestone, i) => {
          const completed = Boolean(milestone.completedAt);
          const isCurrent = milestone.id === currentId;
          const isLast = i === milestones.length - 1;
          return (
            <li key={milestone.id} className="relative flex gap-4">
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-6 top-12 h-[calc(100%-2.5rem)] w-0.5 -translate-x-1/2 ${
                    completed ? "bg-emerald-400" : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              )}
              <button
                onClick={() => toggleMilestone(milestone.id)}
                aria-label={`${completed ? "Un-complete" : "Complete"} ${milestone.title}`}
                className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                  completed
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isCurrent
                      ? "border-amber-500 bg-white text-amber-600 ring-4 ring-amber-100 dark:bg-zinc-900 dark:ring-amber-950"
                      : "border-zinc-300 bg-white text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900"
                }`}
              >
                {completed ? "✓" : i + 1}
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
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Current level
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteMilestone(milestone.id)}
                  aria-label={`Delete ${milestone.title}`}
                  className="shrink-0 p-1 text-zinc-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-2">
        <MilestoneInput
          placeholder={
            milestones.length === 0 ? "Save my first $1,000" : "Next milestone…"
          }
          onAdd={(t) => addMilestone(goal.id, t)}
        />
      </div>
    </>
  );
}

/* ---------- Pyramid & Tree: branching nodes ---------- */

function BranchView({
  goal,
  milestones,
}: {
  goal: Goal;
  milestones: Milestone[];
}) {
  const { addMilestone, toggleMilestone, deleteMilestone } = useApp();
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const childrenOf = (parentId: string | null) =>
    milestones
      .filter((m) => m.parentId === parentId)
      .sort((a, b) => a.position - b.position);

  const renderBranch = (parentId: string | null, depth: number) => {
    const nodes = childrenOf(parentId);
    if (nodes.length === 0) return null;
    return (
      <div
        className={
          depth > 0
            ? "ml-[1.4rem] border-l-2 border-zinc-200 pl-4 dark:border-zinc-700"
            : ""
        }
      >
        {nodes.map((node) => {
          const completed = Boolean(node.completedAt);
          return (
            <div key={node.id}>
              <div className="flex items-center gap-3 py-1.5">
                <button
                  onClick={() => toggleMilestone(node.id)}
                  aria-label={`${completed ? "Un-complete" : "Complete"} ${node.title}`}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                    completed
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-amber-500 bg-white text-amber-600 dark:bg-zinc-900"
                  }`}
                >
                  {completed ? "✓" : "○"}
                </button>
                <p
                  className={`min-w-0 flex-1 ${completed ? "line-through opacity-70" : ""}`}
                >
                  {node.title}
                </p>
                <button
                  onClick={() =>
                    setAddingFor(addingFor === node.id ? null : node.id)
                  }
                  aria-label={`Add under ${node.title}`}
                  className="shrink-0 p-1 text-lg leading-none text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  ＋
                </button>
                <button
                  onClick={() => {
                    const kids = childrenOf(node.id).length;
                    if (
                      kids === 0 ||
                      confirm(
                        `Delete "${node.title}" and everything under it?`
                      )
                    )
                      deleteMilestone(node.id);
                  }}
                  aria-label={`Delete ${node.title}`}
                  className="shrink-0 p-1 text-zinc-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
              {addingFor === node.id && (
                <div className="mb-2 ml-[1.4rem] border-l-2 border-dashed border-zinc-200 pl-4 dark:border-zinc-700">
                  <MilestoneInput
                    placeholder="Sub-goal…"
                    onAdd={(t) => {
                      addMilestone(goal.id, t, node.id);
                      setAddingFor(null);
                    }}
                  />
                </div>
              )}
              {renderBranch(node.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="mt-6">{renderBranch(null, 0)}</div>
      <div className="mt-3">
        <MilestoneInput
          placeholder={
            milestones.length === 0
              ? "First big piece of this goal…"
              : "Another big piece…"
          }
          onAdd={(t) => addMilestone(goal.id, t, null)}
        />
        <p className="mt-2 text-xs text-zinc-400">
          Tap ＋ on a node to break it into smaller sub-goals.
        </p>
      </div>
    </>
  );
}

/* ---------- Tree: a 2D skill-tree map ---------- */

const NODE_R = 22;
const SLOT_W = 96;
const LEVEL_H = 100;
const PAD_X = 56;
const PAD_TOP = 36;
const LABEL_H = 48;

function TreeMapView({
  goal,
  milestones,
}: {
  goal: Goal;
  milestones: Milestone[];
}) {
  const { addMilestone, toggleMilestone, deleteMilestone } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [branching, setBranching] = useState(false);

  const byId = new Map(milestones.map((m) => [m.id, m]));
  const childrenOf = (parentId: string | null) =>
    milestones
      .filter((m) => m.parentId === parentId)
      .sort((a, b) => a.position - b.position);
  const isLocked = (m: Milestone) =>
    m.parentId !== null && !byId.get(m.parentId)?.completedAt;

  // tidy-tree layout: leaves claim slots left to right, parents center over children
  const pos = new Map<string, { x: number; y: number }>();
  let leafCount = 0;
  let maxDepth = 0;
  const layout = (node: Milestone, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = childrenOf(node.id);
    let x: number;
    if (kids.length === 0) {
      x = leafCount++ * SLOT_W;
    } else {
      const xs = kids.map((k) => layout(k, depth + 1));
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    pos.set(node.id, { x: x + PAD_X, y: depth * LEVEL_H + PAD_TOP });
    return x;
  };
  childrenOf(null).forEach((root) => layout(root, 0));

  const width = Math.max((leafCount - 1) * SLOT_W + PAD_X * 2, 280);
  const height = maxDepth * LEVEL_H + PAD_TOP + NODE_R + LABEL_H;

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const select = (id: string | null) => {
    setSelectedId(id);
    setBranching(false);
  };

  return (
    <>
      {milestones.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <svg width={width} height={height} className="block">
            {/* edges */}
            {milestones.map((m) => {
              if (!m.parentId) return null;
              const from = pos.get(m.parentId);
              const to = pos.get(m.id);
              if (!from || !to) return null;
              const midY = (from.y + to.y) / 2;
              return (
                <path
                  key={`edge-${m.id}`}
                  d={`M ${from.x} ${from.y + NODE_R} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y - NODE_R}`}
                  fill="none"
                  strokeWidth={2.5}
                  className={
                    m.completedAt
                      ? "stroke-emerald-400"
                      : isLocked(m)
                        ? "stroke-zinc-200 dark:stroke-zinc-700"
                        : "stroke-amber-300 dark:stroke-amber-700"
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
                        ? "fill-emerald-500 stroke-emerald-600"
                        : locked
                          ? "fill-zinc-100 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-600"
                          : "fill-white stroke-amber-500 dark:fill-zinc-900"
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
                        ? "fill-white font-bold"
                        : locked
                          ? "fill-zinc-400"
                          : "fill-amber-500 font-bold"
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
                        ? "fill-zinc-400 dark:fill-zinc-500"
                        : "fill-zinc-700 dark:fill-zinc-300"
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
        <div className="mt-3 rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-900 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{selected.title}</p>
              <p className="text-xs text-zinc-500">
                {selected.completedAt
                  ? "Completed"
                  : isLocked(selected)
                    ? `Locked — complete "${byId.get(selected.parentId!)?.title}" first`
                    : "Ready to complete"}
              </p>
            </div>
            <button
              onClick={() => select(null)}
              aria-label="Close"
              className="shrink-0 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => toggleMilestone(selected.id)}
              disabled={isLocked(selected)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {selected.completedAt ? "Undo complete" : "✓ Complete"}
            </button>
            <button
              onClick={() => setBranching(!branching)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              ＋ Branch
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
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 hover:text-red-600 dark:border-zinc-700"
            >
              Delete
            </button>
          </div>
          {branching && (
            <div className="mt-3">
              <MilestoneInput
                placeholder="What does this unlock?"
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
                ? "First goal on the map…"
                : "Another starting goal…"
            }
            onAdd={(t) => addMilestone(goal.id, t, null)}
          />
          <p className="mt-2 text-xs text-zinc-400">
            Tap a node to complete it or branch from it. Locked nodes open when
            their parent is done. Scroll the map sideways as it grows.
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
        <p className="text-zinc-600 dark:text-zinc-400">Goal not found.</p>
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
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Goals
      </Link>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">{goal.identity}</h1>
        <span className="shrink-0 text-xs uppercase tracking-wide text-zinc-400">
          {goal.structure}
        </span>
      </div>
      {milestones.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round((done / milestones.length) * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-zinc-500">
            {done}/{milestones.length}
          </span>
        </div>
      )}

      {milestones.length === 0 && (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          {goal.structure === "linear" &&
            "Break this goal into milestones — the levels you'll clear on the way. Start with the first small win."}
          {goal.structure === "pyramid" &&
            "Big goals need many things to come together. Add the major pieces, then break each into sub-goals."}
          {goal.structure === "tree" &&
            "Map it like a skill tree: add starting goals, and completing each unlocks what comes next."}
        </p>
      )}

      {goal.structure === "linear" ? (
        <LinearPath goal={goal} milestones={milestones} />
      ) : goal.structure === "tree" ? (
        <TreeMapView goal={goal} milestones={milestones} />
      ) : (
        <BranchView goal={goal} milestones={milestones} />
      )}
    </div>
  );
}
