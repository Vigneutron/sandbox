"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";

/**
 * Placeholder slot where a real ad network (e.g. AdSense) will render for
 * free-tier users. Pro users never see it.
 */
export function AdBanner() {
  const { state, ready } = useApp();
  if (!ready || state.pro) return null;
  return (
    <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
      Ad space ·{" "}
      <Link
        href="/upgrade"
        className="font-medium text-amber-600 hover:underline dark:text-amber-400"
      >
        Go Pro for $3/mo
      </Link>{" "}
      to remove ads
    </div>
  );
}
