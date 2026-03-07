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
  BarChart2,
  Bookmark,
  HelpCircle,
  Scale,
  ChevronDown,
  Zap,
  Lock,
  Bell,
  Sliders,
  Database,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { BetaBadge } from "@/components/beta-badge"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { SpotlightTutorial } from "@/components/spotlight-tutorial"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  tourId: string
  submenu?: SubMenuItem[]
}

interface SubMenuItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { href: "/dashboard",       label: "Dashboard",       icon: LayoutDashboard, tourId: "tour-dashboard" },
  { href: "/portfolio",       label: "Portfolio",       icon: Briefcase,       tourId: "tour-portfolio" },
  { href: "/analytics",       label: "Analytics",       icon: BarChart2,       tourId: "tour-analytics" },
  { href: "/watchlist",       label: "Watchlist",       icon: Bookmark,        tourId: "tour-watchlist" },
  { href: "/recommendations", label: "Recommendations", icon: Star,            tourId: "tour-recommendations" },
  { href: "/trade",           label: "Trade",           icon: TrendingUp,      tourId: "tour-trade" },
  { href: "/assistant",       label: "AI Assistant",    icon: Bot,             tourId: "tour-assistant" },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    tourId: "tour-settings",
    submenu: [
      { href: "/settings/profile", label: "Profile & Privacy", icon: Lock },
      { href: "/settings/connection", label: "Connection", icon: Zap },
      { href: "/settings/ai", label: "AI & Keys", icon: Lock },
      { href: "/settings/notifications", label: "Notifications", icon: Bell },
      { href: "/settings/portfolio", label: "Portfolio", icon: Sliders },
      { href: "/settings/database", label: "Database", icon: Database },
    ]
  },
]

interface SidebarContentProps {
  pathname: string
  onNavClick: () => void
  onSignOut: () => void
  onTakeTour: () => void
}

function SidebarContent({ pathname, onNavClick, onSignOut, onTakeTour }: SidebarContentProps) {
  const [expandedSubmenu, setExpandedSubmenu] = useState<string | null>(
    navItems.some(item => item.submenu && pathname.startsWith(item.href)) ? "/settings" : null
  )

  return (
    <aside className="flex flex-col h-full w-64 bg-sidebar border-r border-sidebar-border">
      {/* ── Logo ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="relative h-9 w-9 rounded-xl shrink-0">
          <img src="/Logos/investbuddy_favicon_transparent.svg" alt="InvestBuddy AI" className="h-9 w-9" aria-hidden="true" />
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
          const Icon = item.icon
          const active = pathname === item.href || (
            pathname.startsWith(item.href + "/") &&
            !navItems.some((o) => o.href !== item.href && o.href.startsWith(item.href + "/") && pathname.startsWith(o.href))
          )
          const isSettingsMenu = item.submenu !== undefined
          const isExpanded = expandedSubmenu === item.href

          return (
            <div key={item.href}>
              {isSettingsMenu ? (
                <button
                  onClick={() => setExpandedSubmenu(isExpanded ? null : item.href)}
                  className={cn(
                    "group flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    active || isExpanded
                      ? "nav-active text-primary"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active || isExpanded ? "text-primary" : "group-hover:text-foreground"
                    )}
                  />
                  {item.label}
                  <ChevronDown
                    className={cn(
                      "ml-auto h-4 w-4 transition-transform duration-200",
                      isExpanded ? "rotate-180" : ""
                    )}
                  />
                </button>
              ) : (
                <Link
                  href={item.href}
                  onClick={onNavClick}
                  data-tutorial={item.tourId}
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
              )}

              {/* Submenu items */}
              <AnimatePresence>
                {isExpanded && item.submenu && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-0.5 overflow-hidden"
                  >
                    {item.submenu.map((subitem) => {
                      const SubIcon = subitem.icon
                      const subActive = pathname === subitem.href
                      return (
                        <Link
                          key={subitem.href}
                          href={subitem.href}
                          onClick={onNavClick}
                          className={cn(
                            "group flex items-center gap-3 pl-9 pr-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                            subActive
                              ? "nav-active text-primary"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          )}
                        >
                          <SubIcon
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 transition-colors",
                              subActive ? "text-primary" : "group-hover:text-foreground"
                            )}
                          />
                          {subitem.label}
                          {subActive && (
                            <motion.span
                              layoutId="active-nav-indicator-sub"
                              className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                          )}
                        </Link>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* ── Take Tour + Sign out ─────────────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
        <button
          onClick={onTakeTour}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors duration-150"
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          Take a Tour
        </button>
        <Link
          href="/legal"
          onClick={onNavClick}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors duration-150"
        >
          <Scale className="h-4 w-4 shrink-0" />
          Legal & Policies
        </Link>
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
  const [showTour, setShowTour] = useState(false)

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
          <div className="h-7 w-7 rounded-lg shrink-0">
            <img src="/Logos/investbuddy_favicon_transparent.svg" alt="InvestBuddy AI" className="h-7 w-7" aria-hidden="true" />
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
        <SidebarContent pathname={pathname} onNavClick={() => {}} onSignOut={handleSignOut} onTakeTour={() => setShowTour(true)} />
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
            <SidebarContent pathname={pathname} onNavClick={() => setMobileOpen(false)} onSignOut={handleSignOut} onTakeTour={() => setShowTour(true)} />
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

      {/* ── Spotlight tutorial ────────────────────────────────────────── */}
      {showTour && (
        <SpotlightTutorial onComplete={() => setShowTour(false)} />
      )}
    </>
  )
}
