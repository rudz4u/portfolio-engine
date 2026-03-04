import { createRequire } from "module"
const require = createRequire(import.meta.url)
const nextConfig = require("eslint-config-next")

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextConfig,
  {
    rules: {
      // Common data-fetching pattern: setState inside useEffect is intentional
      "react-hooks/set-state-in-effect": "warn",
      // React Compiler purity rules — warn only; these are valid patterns in async handlers
      "react-hooks/purity":        "warn",
      "react-hooks/immutability":  "warn",
      // Missing deps are surfaced as warnings, not hard errors
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
    },
  },
]
