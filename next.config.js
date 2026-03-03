// Bundle analyzer — run: ANALYZE=true npm run build
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    // Tree-shake large packages at build time — reduces bundle sizes
    optimizePackageImports: ["recharts", "lucide-react", "@radix-ui/react-icons"],
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
      "/analytics",
      "/watchlist",
      "/trade",
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

module.exports = withBundleAnalyzer(nextConfig)
