"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Briefcase, ChevronDown, Check } from "lucide-react"

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
 * Shows a dropdown to switch between portfolios.
 * Renders nothing when the user has only one portfolio.
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

  // Only render if the user has more than one portfolio
  if (portfolios.length <= 1) return null

  const currentIndex = portfolios.findIndex((p) => p.id === currentId)
  const current =
    currentIndex >= 0 ? portfolios[currentIndex] : portfolios[0]

  function switchTo(id: string) {
    const params = new URLSearchParams()
    // Only set pid if it is not the default (first/most-recent) portfolio
    if (id !== portfolios[0].id) {
      params.set("pid", id)
    }
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
      <DropdownMenuContent align="end" className="min-w-[200px]">
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
