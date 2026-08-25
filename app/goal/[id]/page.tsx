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
  const isTree = goal.structure === "tree";

  const byId = new Map(milestones.map((m) => [m.id, m]));
  const childrenOf = (parentId: string | null) =>
    milestones
      .filter((m) => m.parentId === parentId)
      .sort((a, b) => a.position - b.position);

  // tree mode: a node is locked until its parent is completed
  const isLocked = (m: Milestone) =>
    isTree && m.parentId !== null && !byId.get(m.parentId)?.completedAt;

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
          const locked = isLocked(node);
          return (
            <div key={node.id}>
              <div
                className={`flex items-center gap-3 py-1.5 ${locked ? "opacity-50" : ""}`}
              >
                <button
                  onClick={() => toggleMilestone(node.id)}
                  disabled={locked}
                  aria-label={
                    locked
                      ? `${node.title} (locked)`
                      : `${completed ? "Un-complete" : "Complete"} ${node.title}`
                  }
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                    completed
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : locked
                        ? "border-zinc-300 bg-zinc-100 text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800"
                        : "border-amber-500 bg-white text-amber-600 dark:bg-zinc-900"
                  }`}
                >
                  {completed ? "✓" : locked ? "🔒" : "○"}
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
                    placeholder={isTree ? "What does this unlock?" : "Sub-goal…"}
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
              ? isTree
                ? "First goal on the map…"
                : "First big piece of this goal…"
              : isTree
                ? "Another starting goal…"
                : "Another big piece…"
          }
          onAdd={(t) => addMilestone(goal.id, t, null)}
        />
        <p className="mt-2 text-xs text-zinc-400">
          {isTree
            ? "Tap ＋ on a node to add what completing it unlocks. Locked nodes open when their parent is done."
            : "Tap ＋ on a node to break it into smaller sub-goals."}
        </p>
      </div>
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
      ) : (
        <BranchView goal={goal} milestones={milestones} />
      )}
    </div>
  );
}
