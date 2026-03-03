/**
 * Server-only helper: resolves the Upstox access token for the current user.
 * Priority: user_settings.preferences.upstox_access_token > UPSTOX_ACCESS_TOKEN env var
 *
 * This lets users paste a fresh daily token from Settings without touching
 * Netlify environment variables (which require a redeploy).
 */
import { createClient } from "@/lib/supabase/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"

export async function resolveUpstoxToken(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data } = await supabase
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

  return UPSTOX_CONFIG.accessToken || null
}
