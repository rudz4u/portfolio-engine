import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  readWatchlists,
  ensureDefaultList,
  generateListId,
  MAX_LISTS,
  WatchlistStore,
} from "@/lib/watchlistModel"

// ─── Shared prefs helpers ─────────────────────────────────────────────────────

async function loadPrefs(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", userId)
    .single()
  return {
    rowExists: !!data,
    prefs:     (data?.preferences as Record<string, unknown>) || {},
  }
}

async function savePrefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rowExists: boolean,
  prefs: Record<string, unknown>
) {
  if (rowExists) {
    await supabase.from("user_settings").update({ preferences: prefs }).eq("user_id", userId)
  } else {
    await supabase.from("user_settings").insert({ user_id: userId, preferences: prefs })
  }
}

function writeStore(prefs: Record<string, unknown>, store: WatchlistStore) {
  prefs.watchlists         = store
  delete prefs.watchlist_symbols // remove legacy key
}

// ─── GET /api/watchlists ─────────────────────────────────────────────────────
// Returns all watchlists with their items.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prefs }  = await loadPrefs(supabase, user.id)
  const store       = ensureDefaultList(readWatchlists(prefs))

  return NextResponse.json({ watchlists: store })
}

// ─── POST /api/watchlists ── { name: string } ─────────────────────────────────
// Creates a new named watchlist.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

  const { rowExists, prefs } = await loadPrefs(supabase, user.id)
  const store = ensureDefaultList(readWatchlists(prefs))

  if (store.length >= MAX_LISTS)
    return NextResponse.json({ error: `Max ${MAX_LISTS} watchlists allowed` }, { status: 400 })

  if (store.some((l) => l.name.toLowerCase() === name.toLowerCase()))
    return NextResponse.json({ error: "A watchlist with this name already exists" }, { status: 400 })

  const newList = { id: generateListId(), name, created_at: new Date().toISOString(), items: [] }
  store.push(newList)
  writeStore(prefs, store)
  await savePrefs(supabase, user.id, rowExists, prefs)

  return NextResponse.json({ watchlist: newList, watchlists: store })
}

// ─── PATCH /api/watchlists?id=xxx ── { name: string } ────────────────────────
// Renames a watchlist.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id   = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const body = await request.json()
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

  const { rowExists, prefs } = await loadPrefs(supabase, user.id)
  const store = ensureDefaultList(readWatchlists(prefs))

  const list = store.find((l) => l.id === id)
  if (!list) return NextResponse.json({ error: "Watchlist not found" }, { status: 404 })

  list.name = name
  writeStore(prefs, store)
  await savePrefs(supabase, user.id, rowExists, prefs)

  return NextResponse.json({ watchlist: list, watchlists: store })
}

// ─── DELETE /api/watchlists?id=xxx ───────────────────────────────────────────
// Deletes a watchlist (cannot delete the default/last list).
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const { rowExists, prefs } = await loadPrefs(supabase, user.id)
  const store = ensureDefaultList(readWatchlists(prefs))

  if (store.length <= 1)
    return NextResponse.json({ error: "Cannot delete the last watchlist" }, { status: 400 })

  const filtered = store.filter((l) => l.id !== id)
  if (filtered.length === store.length)
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 })

  writeStore(prefs, filtered)
  await savePrefs(supabase, user.id, rowExists, prefs)

  return NextResponse.json({ watchlists: filtered })
}
