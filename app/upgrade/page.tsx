"use client";

import { useApp } from "@/lib/store";
import { FREE_GOAL_LIMIT } from "@/lib/types";

const PERKS = [
  "Unlimited goals and habits",
  "No ads, ever",
  "Priority access to new features (reminders, insights, data export)",
];

export default function UpgradePage() {
  const { state, ready, upgrade } = useApp();

  if (!ready) return null;

  if (state.pro) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">You&apos;re on Goal Goal Gadget Pro 🎉</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Unlimited goals, no ads. Thanks for supporting Goal Goal Gadget.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="text-center text-2xl font-bold">Goal Goal Gadget Pro</h1>
      <p className="mt-2 text-center text-zinc-600 dark:text-zinc-400">
        The free plan includes {FREE_GOAL_LIMIT} goals with ads. Pro removes
        every limit for less than a coffee.
      </p>

      <div className="mt-6 rounded-xl border border-amber-300 bg-white p-6 dark:border-amber-700 dark:bg-zinc-900">
        <p className="text-center">
          <span className="text-4xl font-bold">$3</span>
          <span className="text-zinc-500">/month</span>
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {PERKS.map((perk) => (
            <li key={perk} className="flex gap-2">
              <span className="text-emerald-600">✓</span>
              {perk}
            </li>
          ))}
        </ul>
        <button
          onClick={upgrade}
          className="mt-6 w-full rounded-lg bg-amber-500 py-2.5 font-medium text-white hover:bg-amber-600"
        >
          Upgrade to Pro
        </button>
        <p className="mt-3 text-center text-xs text-zinc-400">
          Demo checkout — Stripe billing coming before launch.
        </p>
      </div>
    </div>
  );
}
