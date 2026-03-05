// Bundle analyzer — run: ANALYZE=true npm run build
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep pdf-parse as a native require — do NOT bundle it into server chunks.
  // pdf-parse's entry point runs a self-test that reads a local file, which crashes
  // in serverless/Netlify environments when bundled. Marking it external prevents this.
  serverExternalPackages: ["pdf-parse"],
  images: {
    unoptimized: true,
  },
  experimental: {
    // Tree-shake large packages at build time — reduces bundle sizes
    optimizePackageImports: ["recharts", "lucide-react", "@radix-ui/react-icons"],
  },
}

module.exports = withBundleAnalyzer(nextConfig)
