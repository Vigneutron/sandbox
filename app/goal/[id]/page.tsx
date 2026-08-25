import GoalClient from "./goal-client";

// The goal page renders entirely on the client from synced state, so the
// shell is static: served from the CDN and prefetched by dashboard links,
// instead of hitting a serverless function on every tap.
export function generateStaticParams() {
  return [];
}

export default function GoalPage() {
  return <GoalClient />;
}
