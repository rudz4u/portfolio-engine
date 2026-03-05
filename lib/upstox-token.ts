/**
 * Server-only helper: resolves the Upstox access token for the current user.
 * Priority: user_settings.preferences.upstox_access_token > UPSTOX_ACCESS_TOKEN env var
 *
 * Uses the admin (service-role) client so the query bypasses RLS and works
 * even if the cookie-based session is temporarily unavailable (e.g. in an
 * API route running after an OAuth redirect).
 */
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"

export async function resolveUpstoxToken(): Promise<string | null> {
  try {
    // 1. Identify the current user via cookie session.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // 2. Read preferences via admin client so RLS never blocks the read.
      const admin = await createAdminClient()
      const { data } = await admin
        .from("user_settings")
        .select("preferences")
        .eq("user_id", user.id)
        .single()

      const prefs = (data?.preferences as Record<string, string> | null) ?? {}
      if (prefs.upstox_access_token) {
        return prefs.upstox_access_token
      }
    }
  } catch {
    // fall through to env var
  }

  // Last resort: static env-var token (dev/admin).  Returns null if not set.
  return UPSTOX_CONFIG.accessToken || null
}
