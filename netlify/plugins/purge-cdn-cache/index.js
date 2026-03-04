/**
 * Netlify Build Plugin — Purge CDN Cache on Deploy
 *
 * After a successful deploy, this plugin calls the Netlify Purge API
 * to invalidate ALL edge-cached responses. This prevents stale HTML
 * (referencing old JS/CSS chunk hashes) from being served on custom
 * domains where atomic-deploy cache invalidation can be unreliable.
 *
 * The plugin uses NETLIFY_API_TOKEN (personal access token) if set,
 * falling back to the automatically-available SITE_ID + internal token.
 */
module.exports = {
  async onSuccess({ constants, utils }) {
    const siteId = constants.SITE_ID || process.env.SITE_ID
    // Netlify provides several token env vars depending on context
    const token =
      process.env.NETLIFY_API_TOKEN ||
      process.env.NETLIFY_AUTH_TOKEN ||
      process.env.NETLIFY_PURGE_API_TOKEN

    if (!siteId) {
      console.log("[purge-cdn-cache] SITE_ID not available, skipping CDN purge")
      return
    }

    if (!token) {
      console.log(
        "[purge-cdn-cache] No API token available (NETLIFY_API_TOKEN / NETLIFY_AUTH_TOKEN)."
      )
      console.log(
        "[purge-cdn-cache] Set NETLIFY_API_TOKEN in Netlify env vars to enable automatic CDN purge."
      )
      console.log(
        "[purge-cdn-cache] You can create a token at: https://app.netlify.com/user/applications#personal-access-tokens"
      )
      return
    }

    console.log(`[purge-cdn-cache] Purging CDN cache for site ${siteId}...`)

    try {
      const res = await fetch("https://api.netlify.com/api/v1/purge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ site_id: siteId }),
      })

      if (res.ok) {
        console.log("[purge-cdn-cache] CDN cache purged successfully")
      } else {
        const body = await res.text()
        console.log(`[purge-cdn-cache] Purge API returned ${res.status}: ${body}`)
      }
    } catch (err) {
      // Non-fatal: don't fail the deploy if purge fails
      console.error("[purge-cdn-cache] Purge request failed:", err.message)
    }
  },
}
