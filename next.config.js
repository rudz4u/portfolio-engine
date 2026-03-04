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
}

module.exports = withBundleAnalyzer(nextConfig)
