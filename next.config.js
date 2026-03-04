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
    // Prevent Netlify Edge / Durable Cache from caching ANY HTML page.
    // The @netlify/plugin-nextjs v5.5+ overrides netlify.toml header rules for
    // SSR/ISR pages — it sets long-lived CDN cache TTLs internally. After a
    // deploy, atomic-deploy invalidation can miss variation buckets for custom
    // domains (e.g. brokerai.rudz.in), causing stale HTML that references old
    // JS/CSS chunk hashes which no longer exist (resulting in 404 / MIME errors).
    // This catch-all forces Netlify to never serve cached HTML on any domain.
    return [
      {
        source: "/:path*",
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
      },
    ]
  },
}

module.exports = withBundleAnalyzer(nextConfig)
