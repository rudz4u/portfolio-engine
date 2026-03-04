import type { Config } from "@netlify/functions"
import { runAdvisoryScan } from "./advisory-scan-morning.mts"

// ── 4:00 PM IST = 10:30 AM UTC ────────────────────────────────────────────
export default async function handler() { await runAdvisoryScan() }
export const config: Config = { schedule: "30 10 * * 1-5" }
