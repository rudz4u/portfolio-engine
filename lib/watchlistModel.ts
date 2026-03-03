/**
 * Shared watchlist data model helpers.
 *
 * Storage: user_settings.preferences.watchlists (JSON array)
 *
 * Model:
 *   WatchlistStore = WatchlistDef[]
 *   WatchlistDef   = { id, name, created_at, items: WatchlistItem[] }
 *   WatchlistItem  = { instrument_key, trading_symbol, company_name, exchange, added_at }
 */

export interface WatchlistItem {
  instrument_key: string
  trading_symbol: string
  company_name:   string
  exchange:       string
  added_at:       string
}

export interface WatchlistDef {
  id:         string
  name:       string
  created_at: string
  items:      WatchlistItem[]
}

export type WatchlistStore = WatchlistDef[]

export const DEFAULT_LIST_ID = "default"
export const MAX_LISTS        = 10
export const MAX_ITEMS        = 50

/** Read watchlists from raw prefs, auto-migrating legacy watchlist_symbols. */
export function readWatchlists(prefs: Record<string, unknown>): WatchlistStore {
  // New format
  if (Array.isArray(prefs.watchlists)) {
    return prefs.watchlists as WatchlistStore
  }

  // Legacy: watchlist_symbols = string[]
  const legacy = prefs.watchlist_symbols
  const legacySymbols: string[] = Array.isArray(legacy)
    ? (legacy as string[])
    : typeof legacy === "string"
    ? (() => { try { return JSON.parse(legacy) } catch { return (legacy as string).split(",").filter(Boolean) } })()
    : []

  if (legacySymbols.length === 0) return []

  // Migrate to new format as "Default" list
  return [{
    id:         DEFAULT_LIST_ID,
    name:       "Default",
    created_at: new Date().toISOString(),
    items:      legacySymbols.map((k) => ({
      instrument_key: k,
      trading_symbol: k.includes("|") ? k.split("|")[1] : k,
      company_name:   k.includes("|") ? k.split("|")[1] : k,
      exchange:       k.includes("_") ? k.split("_")[0] : "NSE",
      added_at:       new Date().toISOString(),
    })),
  }]
}

export function getDefaultList(store: WatchlistStore): WatchlistDef | undefined {
  return store.find((l) => l.id === DEFAULT_LIST_ID) ?? store[0]
}

export function ensureDefaultList(store: WatchlistStore): WatchlistStore {
  if (store.length === 0 || !store.find((l) => l.id === DEFAULT_LIST_ID)) {
    return [
      { id: DEFAULT_LIST_ID, name: "Default", created_at: new Date().toISOString(), items: [] },
      ...store,
    ]
  }
  return store
}

export function generateListId(): string {
  return `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
