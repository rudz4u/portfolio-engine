export interface ScoringWeights {
  momentum: number  // 0-100, default 30
  valuation: number // 0-100, default 25
  position: number  // 0-100, default 20
  advisory: number  // 0-100, default 25
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  momentum: 30,
  valuation: 25,
  position: 20,
  advisory: 25,
}

export function validateWeights(w: unknown): ScoringWeights | null {
  if (!w || typeof w !== "object") return null
  const obj = w as Record<string, unknown>
  const keys: (keyof ScoringWeights)[] = ["momentum", "valuation", "position", "advisory"]
  for (const k of keys) {
    if (typeof obj[k] !== "number" || (obj[k] as number) < 5 || (obj[k] as number) > 60) return null
  }
  const sum = keys.reduce((s, k) => s + (obj[k] as number), 0)
  if (sum !== 100) return null
  return obj as unknown as ScoringWeights
}
