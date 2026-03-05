"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Briefcase,
  Settings,
  TrendingUp,
  LogOut,
  Bot,
  Menu,
  X,
  Star,
  Zap,
  BarChart2,
  Bookmark,
  Upload,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { BetaBadge } from "@/components/beta-badge"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

const navItems = [
  { href: "/dashboard",        label: "Dashboard",        icon: LayoutDashboard },
  { href: "/portfolio",        label: "Portfolio",        icon: Briefcase },
  { href: "/portfolio/import", label: "Import Holdings",  icon: Upload },
  { href: "/analytics",        label: "Analytics",        icon: BarChart2 },
  { href: "/watchlist",        label: "Watchlist",        icon: Bookmark },
  { href: "/recommendations",  label: "Recommendations",  icon: Star },
  { href: "/trade",            label: "Trade",            icon: TrendingUp },
  { href: "/assistant",        label: "AI Assistant",     icon: Bot },
  { href: "/settings",         label: "Settings",         icon: Settings },
]

interface SidebarContentProps {
  pathname: string
  onNavClick: () => void
  onSignOut: () => void
}

function SidebarContent({ pathname, onNavClick, onSignOut }: SidebarContentProps) {
  return (
    <aside className="flex flex-col h-full w-64 bg-sidebar border-r border-sidebar-border">
      {/* ── Logo ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg glow-sm shrink-0">
          <Zap className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight gradient-text">InvestBuddy AI</span>
            <BetaBadge tooltip />
          </div>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Quant · AI · Markets</p>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon   = item.icon
          // Exact match OR prefix match that doesn't collide with a more specific nav item
          const active = pathname === item.href || (
            pathname.startsWith(item.href + "/") &&
            !navItems.some((o) => o.href !== item.href && o.href.startsWith(item.href + "/") && pathname.startsWith(o.href))
          )
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "nav-active text-primary"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-primary" : "group-hover:text-foreground"
                )}
              />
              {item.label}
              {active && (
                <motion.span
                  layoutId="active-nav-indicator"
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Sign out ──────────────────────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/signin")
    router.refresh()
  }

  return (
    <>
      {/* ── Mobile header bar ─────────────────────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-sm gradient-text">InvestBuddy AI</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <div className="hidden lg:flex">
        <SidebarContent pathname={pathname} onNavClick={() => {}} onSignOut={handleSignOut} />
      </div>

      {/* ── Mobile sidebar ────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-sidebar"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-y-0 left-0 z-50 lg:hidden"
          >
            <SidebarContent pathname={pathname} onNavClick={() => setMobileOpen(false)} onSignOut={handleSignOut} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
