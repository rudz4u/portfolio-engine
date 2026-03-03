"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Briefcase, ChevronDown, Check, Plus } from "lucide-react"

export interface PortfolioOption {
  id: string
  source: string | null
  name: string | null
  fetched_at: string | null
}

function portfolioLabel(p: PortfolioOption, index: number): string {
  if (p.name) return p.name
  if (p.source) {
    const src = p.source.charAt(0).toUpperCase() + p.source.slice(1)
    return index === 0 ? `${src} Portfolio` : `${src} Portfolio ${index + 1}`
  }
  return `Portfolio ${index + 1}`
}

/**
 * Portfolio switcher dropdown.
 * - With 1 portfolio: shows the current name + a hint to add more via Settings.
 * - With 2+ portfolios: full switcher with all options.
 */
export function PortfolioSwitcher({
  portfolios,
  currentId,
}: {
  portfolios: PortfolioOption[]
  currentId: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const currentIndex = portfolios.findIndex((p) => p.id === currentId)
  const current = currentIndex >= 0 ? portfolios[currentIndex] : portfolios[0]

  if (!current) return null

  function switchTo(id: string) {
    const params = new URLSearchParams()
    if (id !== portfolios[0].id) params.set("pid", id)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          {portfolioLabel(current, currentIndex >= 0 ? currentIndex : 0)}
          <ChevronDown className="h-3 w-3 ml-0.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[220px]">
        {/* All portfolios */}
        {portfolios.map((p, i) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => switchTo(p.id)}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex flex-col">
              <span className={p.id === currentId ? "font-semibold" : ""}>
                {portfolioLabel(p, i)}
              </span>
              {p.fetched_at && (
                <span className="text-xs text-muted-foreground">
                  Synced{" "}
                  {new Date(p.fetched_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                  })}
                </span>
              )}
            </div>
            {p.id === currentId && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Add / manage link → Settings */}
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            {portfolios.length === 1
              ? "Connect another account"
              : "Manage portfolios"}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
