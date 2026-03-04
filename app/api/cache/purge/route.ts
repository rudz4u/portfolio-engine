import { NextResponse } from "next/server"

/**
 * POST /api/cache/purge
 *
 * Purges the Netlify CDN edge cache for this site.
 * Called automatically by the post-deploy build plugin, or manually
 * when stale HTML responses appear on the custom domain.
 *
 * Auth: requires the CRON_SECRET header (same secret used by cron jobs)
 *       OR the internal Netlify deploy hook token.
 */
export async function POST(request: Request) {
  // Simple auth check — reuse CRON_SECRET or accept Netlify internal calls
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isNetlifyInternal = request.headers.get("x-netlify-deploy-hook") === "true"

  if (!isNetlifyInternal && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // @netlify/functions purgeCache() uses NETLIFY_PURGE_API_TOKEN
    // which is auto-injected at runtime in Netlify Functions
    const { purgeCache } = await import("@netlify/functions")
    await purgeCache()
    console.log("[cache-purge] CDN cache purged successfully")
    return NextResponse.json({ ok: true, message: "CDN cache purged" })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[cache-purge] Failed to purge CDN cache:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
