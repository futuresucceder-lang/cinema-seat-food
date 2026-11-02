import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminSupabase: SupabaseClient | null = null;

/**
 * Create the service-role client only when a server request needs it.
 * Do not read or validate server secrets at module-import/build time.
 */
export function getAdminSupabase(): SupabaseClient {
  if (cachedAdminSupabase) return cachedAdminSupabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing server-side Supabase environment variables.");
  }

  cachedAdminSupabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return cachedAdminSupabase;
}
