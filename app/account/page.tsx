"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";

export default function AccountPage() {
  const { user, ready, cloudEnabled, signIn, signUp, signOut } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;

  if (!cloudEnabled) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Accounts coming soon</h1>
        <p className="mx-auto mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
          Cloud sync isn&apos;t configured on this deployment yet. Your goals
          are saved in this browser in the meantime.
        </p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <h1 className="text-2xl font-bold">Your account</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Signed in as <span className="font-medium">{user.email}</span>. Your
          goals and streaks sync to every device you sign in on.
        </p>
        <button
          onClick={signOut}
          className="mt-6 rounded-lg border border-zinc-300 px-5 py-2.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
        <p className="mt-3 text-xs text-zinc-400">
          Signing out clears this device&apos;s copy — your data stays safe in
          your account.
        </p>
      </div>
    );
  }

  const submit = async (mode: "in" | "up") => {
    setBusy(true);
    setMessage(null);
    const err = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    setMessage(err);
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="text-center text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Create a free account to sync your goals across devices. Anything
        already on this device comes with you.
      </p>

      <form
        className="mt-6 space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        onSubmit={(e) => {
          e.preventDefault();
          submit("in");
        }}
      >
        <label className="block text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>

        {message && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Sign in
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("up")}
            className="flex-1 rounded-md border border-zinc-300 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}
