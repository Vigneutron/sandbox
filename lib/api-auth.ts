import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Server-side helper for API routes: verifies the caller's Supabase access
 * token (from the Authorization header) and returns the user, plus a client
 * scoped to that user's permissions for RLS-guarded reads.
 */
export async function getUserFromRequest(
  req: Request
): Promise<{ user: User; asUser: SupabaseClient } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return null;

  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await asUser.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, asUser };
}
