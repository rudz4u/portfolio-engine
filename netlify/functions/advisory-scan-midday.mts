import type { Config } from "@netlify/functions"
import { runAdvisoryScan } from "./advisory-scan-morning.mts"

// ── 12:30 PM IST = 7:00 AM UTC ────────────────────────────────────────────
export default async function handler() { await runAdvisoryScan() }
export const config: Config = { schedule: "0 7 * * 1-5" }
