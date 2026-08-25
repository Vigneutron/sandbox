"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { FREE_GOAL_LIMIT } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";

const PERKS = [
  "Unlimited goals and habits",
  "No ads, ever",
  "Priority access to new features (reminders, insights, data export)",
];

async function callBilling(path: string): Promise<{ url?: string; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Billing isn't configured on this deployment yet." };
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Please sign in first." };
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  } catch {
    return { error: "Network error — please try again." };
  }
}

export default function UpgradePage() {
  const { state, ready, user, refreshPro } = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const pollCount = useRef(0);

  // After Stripe redirects back with ?success=1, the webhook may take a few
  // seconds to land — poll Pro status until it flips.
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    // the URL is client-only state; reading it in an effect (not an
    // initializer) keeps server and first client render identical
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("success")) setJustPaid(true);
    if (params.get("canceled")) setMessage("Checkout canceled — no charge was made.");
  }, [ready]);

  useEffect(() => {
    if (!justPaid || state.pro || pollCount.current >= 15) return;
    const t = setTimeout(() => {
      pollCount.current += 1;
      refreshPro();
    }, 2000);
    return () => clearTimeout(t);
  }, [justPaid, state.pro, refreshPro]);

  if (!ready) return null;

  if (state.pro) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">You&apos;re on Goal Goal Gadget Pro 🎉</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Unlimited goals, no ads. Thanks for supporting Goal Goal Gadget.
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { url, error } = await callBilling("/api/portal");
            setBusy(false);
            if (url) window.location.href = url;
            else setMessage(error ?? "Something went wrong.");
          }}
          className="mt-6 rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Manage subscription
        </button>
        {message && <p className="mt-3 text-sm text-zinc-500">{message}</p>}
      </div>
    );
  }

  if (justPaid) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">Payment received</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Activating your Pro membership — this usually takes a few seconds…
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

        {user ? (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage(null);
              const { url, error } = await callBilling("/api/checkout");
              if (url) {
                window.location.href = url;
                return;
              }
              setBusy(false);
              setMessage(error ?? "Something went wrong.");
            }}
            className="mt-6 w-full rounded-lg bg-amber-500 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {busy ? "Opening checkout…" : "Upgrade to Pro"}
          </button>
        ) : (
          <Link
            href="/account"
            className="mt-6 block w-full rounded-lg bg-amber-500 py-2.5 text-center font-medium text-white hover:bg-amber-600"
          >
            Sign in to upgrade
          </Link>
        )}

        {message && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {message}
          </p>
        )}
        <p className="mt-3 text-center text-xs text-zinc-400">
          Secure checkout by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
