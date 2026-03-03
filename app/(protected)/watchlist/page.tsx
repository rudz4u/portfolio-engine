"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import {
  Bookmark, BookmarkX, RefreshCw, TrendingUp, TrendingDown, ExternalLink,
  Plus, Search, Pencil, Trash2, ChevronDown, X, Check, ListPlus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface WatchlistItem {
  instrument_key: string
  trading_symbol: string
  company_name:   string
  exchange:       string
  added_at:       string
}

interface WatchlistDef {
  id:         string
  name:       string
  created_at: string
  items:      WatchlistItem[]
}

interface HoldingData {
  id:              string
  instrument_key:  string
  company_name?:   string | null
  trading_symbol?: string | null
  quantity:        number
  avg_price:       number
  ltp:             number
  invested_amount: number
  unrealized_pl:   number
  segment?:        string | null
  raw?:            Record<string, unknown> | null
}

interface SearchResult {
  instrument_key: string
  trading_symbol: string
  company_name:   string
  exchange:       string
  isin?:          string | null
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function resolveDisplay(item: WatchlistItem, holding?: HoldingData) {
  const raw  = (holding?.raw as Record<string, unknown>) || {}
  const sym  = holding?.trading_symbol || (raw.trading_symbol as string) || item.trading_symbol
  const name = holding?.company_name   || (raw.company_name   as string) || item.company_name
  return { sym, name }
}

function fmtInr(n: number) {
  return `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ─── Stock Search ───────────────────────────────────────────────────────── */

function StockSearch({ listId, existingKeys, onAdded }: {
  listId: string; existingKeys: Set<string>; onAdded: () => void
}) {
  const [query,   setQuery]   = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [open,    setOpen]    = useState(false)
  const [adding,  setAdding]  = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const debRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", outside)
    return () => document.removeEventListener("mousedown", outside)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/instruments/search?q=${encodeURIComponent(q)}&limit=10`)
      const data = await res.json()
      setResults(data.results ?? [])
      setOpen(true)
    } finally { setLoading(false) }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => search(val), 300)
  }

  async function addToList(r: SearchResult) {
    setAdding(r.instrument_key)
    try {
      await fetch(`/api/watchlists/${listId}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument_key: r.instrument_key, trading_symbol: r.trading_symbol, company_name: r.company_name, exchange: r.exchange }),
      })
      setQuery(""); setResults([]); setOpen(false)
      onAdded()
    } finally { setAdding(null) }
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input placeholder="Search NSE / BSE stocks to add…" value={query} onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)} className="pl-8 pr-8" />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false) }}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-72 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
          {!loading && results.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No results for &quot;{query}&quot;</div>}
          {results.map((r) => {
            const already = existingKeys.has(r.instrument_key)
            return (
              <button key={r.instrument_key} disabled={already || adding === r.instrument_key}
                onClick={() => !already && addToList(r)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-default">
                <div className="min-w-0">
                  <span className="font-medium">{r.trading_symbol}</span>
                  {r.company_name !== r.trading_symbol && (
                    <span className="ml-1.5 text-xs text-muted-foreground truncate">{r.company_name}</span>
                  )}
                  <span className="ml-1.5 text-xs text-muted-foreground/60">{r.exchange}</span>
                </div>
                {already
                  ? <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  : adding === r.instrument_key
                    ? <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                    : <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Watchlist Card ─────────────────────────────────────────────────────── */

function WatchlistCard({ item, holding, listId, onRemoved }: {
  item: WatchlistItem; holding?: HoldingData; listId: string; onRemoved: () => void
}) {
  const [removing, setRemoving] = useState(false)
  const { sym, name } = resolveDisplay(item, holding)

  async function remove() {
    setRemoving(true)
    try {
      await fetch(`/api/watchlists/${listId}/items?instrument_key=${encodeURIComponent(item.instrument_key)}`, { method: "DELETE" })
      onRemoved()
    } finally { setRemoving(false) }
  }

  const ltp     = holding?.ltp            ?? 0
  const pnl     = holding?.unrealized_pl  ?? 0
  const invested = holding?.invested_amount ?? 0
  const pnlPct  = invested > 0 ? (pnl / invested) * 100 : 0
  const pnlPos  = pnl >= 0
  const raw     = (holding?.raw as Record<string, unknown>) || {}
  const dayChg  = (raw.day_change_percentage as number) || 0

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{sym}</CardTitle>
            {name !== sym && <CardDescription className="text-xs mt-0.5 truncate">{name}</CardDescription>}
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px] px-1 py-0">{item.exchange}</Badge>
              {holding?.segment && <Badge variant="secondary" className="text-[10px] px-1 py-0">{holding.segment}</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link href={`/portfolio/${encodeURIComponent(item.instrument_key)}`} title="View detail"
              className="text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button onClick={remove} disabled={removing} className="text-primary hover:text-destructive transition-colors" title="Remove">
              <BookmarkX className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {!holding ? (
          <p className="text-xs text-muted-foreground italic">Not in your portfolio</p>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">LTP</p>
                <p className="text-xl font-bold tabular-nums">{ltp ? fmtInr(ltp) : "—"}</p>
              </div>
              {dayChg !== 0 && (
                <div className={`flex items-center gap-0.5 text-sm font-medium ${dayChg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {dayChg >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {Math.abs(dayChg).toFixed(2)}%
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-xs">Unrealised P&amp;L</span>
              <span className={`font-semibold tabular-nums ${pnlPos ? "text-emerald-400" : "text-red-400"}`}>
                {pnlPos ? "+" : "−"}{fmtInr(pnl)}{" "}
                <span className="text-xs font-normal">({pnlPos ? "+" : "−"}{Math.abs(pnlPct).toFixed(2)}%)</span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function WatchlistPage() {
  const [watchlists,   setWatchlists]   = useState<WatchlistDef[]>([])
  const [activeId,     setActiveId]     = useState<string>("default")
  const [holdings,     setHoldings]     = useState<HoldingData[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)

  const [createOpen,  setCreateOpen]  = useState(false)
  const [createName,  setCreateName]  = useState("")
  const [creating,    setCreating]    = useState(false)
  const [createError, setCreateError] = useState("")
  const [renameOpen,  setRenameOpen]  = useState(false)
  const [renameId,    setRenameId]    = useState("")
  const [renameName,  setRenameName]  = useState("")
  const [renaming,    setRenaming]    = useState(false)
  const [deleteId,    setDeleteId]    = useState("")
  const [deleteOpen,  setDeleteOpen]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/watchlists")
      const data = await res.json()
      const lists: WatchlistDef[] = data.watchlists ?? []
      setWatchlists(lists)
      if (lists.length > 0 && !lists.find((l) => l.id === activeId)) setActiveId(lists[0].id)
    } finally { setLoading(false) }
  }, [activeId])

  const loadItems = useCallback(async (listId: string) => {
    setLoadingItems(true)
    try {
      const res  = await fetch(`/api/watchlists/${listId}/items`)
      const data = await res.json()
      setHoldings(data.holdings ?? [])
      if (data.list) setWatchlists((prev) => prev.map((l) => l.id === listId ? data.list : l))
    } finally { setLoadingItems(false) }
  }, [])

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (activeId) loadItems(activeId) }, [activeId, loadItems])

  const activeList   = watchlists.find((l) => l.id === activeId)
  const holdingMap   = new Map(holdings.map((h) => [h.instrument_key, h]))
  const existingKeys = new Set(activeList?.items.map((i) => i.instrument_key) ?? [])

  async function createList() {
    if (!createName.trim()) return
    setCreating(true); setCreateError("")
    try {
      const res  = await fetch("/api/watchlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: createName.trim() }) })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || "Failed"); return }
      setWatchlists(data.watchlists); setActiveId(data.watchlist.id)
      setCreateOpen(false); setCreateName("")
    } finally { setCreating(false) }
  }

  async function renameList() {
    if (!renameName.trim()) return
    setRenaming(true)
    try {
      const res  = await fetch(`/api/watchlists?id=${renameId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: renameName.trim() }) })
      const data = await res.json()
      if (res.ok) { setWatchlists(data.watchlists); setRenameOpen(false) }
    } finally { setRenaming(false) }
  }

  async function deleteList() {
    setDeleting(true)
    try {
      const res  = await fetch(`/api/watchlists?id=${deleteId}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        const remaining = data.watchlists as WatchlistDef[]
        setWatchlists(remaining)
        if (deleteId === activeId) setActiveId(remaining[0]?.id ?? "default")
        setDeleteOpen(false)
      }
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-primary" /> Watchlists
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track any NSE/BSE stock — not limited to your portfolio.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadItems(activeId)} disabled={loadingItems}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingItems ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => { setCreateName(""); setCreateError(""); setCreateOpen(true) }}>
            <ListPlus className="h-4 w-4 mr-1.5" /> New list
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 space-y-2">
              <Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /><Skeleton className="h-6 w-24 mt-2" />
            </CardContent></Card>
          ))}
        </div>
      ) : (
        <>
          {/* Watchlist tabs */}
          {watchlists.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {watchlists.map((list) => (
                <div key={list.id} className="relative group flex items-center">
                  <button onClick={() => setActiveId(list.id)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
                      activeId === list.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                    }`}>
                    {list.name}
                    <span className={`ml-1.5 text-xs ${activeId === list.id ? "opacity-80" : "text-muted-foreground"}`}>{list.items.length}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent">
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                      <DropdownMenuItem onClick={() => { setRenameId(list.id); setRenameName(list.name); setRenameOpen(true) }}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      {watchlists.length > 1 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => { setDeleteId(list.id); setDeleteOpen(true) }}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}

          {/* Search bar */}
          {activeList && <StockSearch listId={activeId} existingKeys={existingKeys} onAdded={() => loadItems(activeId)} />}

          {/* Cards */}
          {!activeList || activeList.items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Bookmark className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">This watchlist is empty.</p>
                <p className="text-xs text-muted-foreground">
                  Search for stocks above, or bookmark from the{" "}
                  <Link href="/portfolio" className="text-primary hover:underline">Portfolio</Link> table.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeList.items.map((item) => (
                <WatchlistCard key={item.instrument_key} item={item}
                  holding={holdingMap.get(item.instrument_key)} listId={activeId}
                  onRemoved={() => loadItems(activeId)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New watchlist</DialogTitle></DialogHeader>
          <Input placeholder="e.g. Defense Stocks, Future Buys…" value={createName}
            onChange={(e) => setCreateName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createList()} autoFocus />
          {createError && <p className="text-xs text-destructive">{createError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createList} disabled={!createName.trim() || creating}>{creating ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rename watchlist</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && renameList()} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={renameList} disabled={!renameName.trim() || renaming}>{renaming ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete watchlist?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the watchlist and all its symbols.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteList} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

