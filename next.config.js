/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async headers() {
    // Prevent Netlify durable cache from storing stale HTML for authenticated pages.
    // Per https://docs.netlify.com/build/caching/caching-overview/ the Next.js plugin
    // v5.5+ auto-enables durable cache with 1-year TTL. Atomic-deploy invalidation
    // can miss variation buckets, causing broken JS chunk references on direct URL loads.
    // Setting no-store here overrides the plugin and forces Netlify to never cache
    // these SSR pages in the durable cache or edge cache.
    const protectedRoutes = [
      "/dashboard",
      "/portfolio",
      "/settings",
      "/assistant",
      "/recommendations",
      "/sandbox",
    ]
    return protectedRoutes.map((path) => ({
      source: path,
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-store, must-revalidate",
        },
        {
          key: "Netlify-CDN-Cache-Control",
          value: "no-store",
        },
      ],
    }))
  },
}

module.exports = nextConfig
