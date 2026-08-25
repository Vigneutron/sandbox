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
    <div className="mt-8 rounded-lg border border-dashed border-gray-600 p-4 text-center text-sm text-gray-400">
      Ad space ·{" "}
      <Link
        href="/upgrade"
        className="font-medium text-gold-400 hover:underline"
      >
        Go Pro for $3/mo
      </Link>{" "}
      to remove ads
    </div>
  );
}
