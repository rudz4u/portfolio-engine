import type { Config } from "@netlify/functions"
import { runAdvisoryScan } from "./advisory-scan-morning.mts"

// ── 8:00 PM IST = 2:30 PM UTC ─────────────────────────────────────────────
export default async function handler() { await runAdvisoryScan() }
export const config: Config = { schedule: "30 14 * * 1-5" }
