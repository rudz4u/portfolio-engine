"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { Sparkles, X } from "lucide-react"
import Link from "next/link"

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  const [checked, setChecked] = useState(false)
  const [showProfileNudge, setShowProfileNudge] = useState(false)

  useEffect(() => {
    // Fast-path: if already done (stored locally), skip the API call entirely.
    // This prevents the wizard from re-triggering on every page navigation.
    if (typeof window !== "undefined" && localStorage.getItem("buddy_onboarding_done") === "true") {
      setChecked(true)
      // Check if we should show the profile nudge for existing users
      if (localStorage.getItem("investor_profile_nudge_dismissed") !== "true") {
        fetch("/api/profile/investor")
          .then((r) => r.json())
          .then((data) => {
            if (!data?.profile) {
              setTimeout(() => setShowProfileNudge(true), 2000)
            }
          })
          .catch(() => { /* non-critical */ })
      }
      return
    }

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const prefs = data?.preferences ?? {}
        if (prefs.onboarding_completed !== "true") {
          // Small delay so dashboard content loads first
          setTimeout(() => setShow(true), 800)
        } else {
          // Cache so we skip the fetch next time
          localStorage.setItem("buddy_onboarding_done", "true")
        }
      })
      .catch(() => { /* silently ignore — don't block the app */ })
      .finally(() => setChecked(true))
  }, [])

  function dismissNudge() {
    localStorage.setItem("investor_profile_nudge_dismissed", "true")
    setShowProfileNudge(false)
  }

  return (
    <>
      {children}
      {checked && (
        <AnimatePresence>
          {show && (
            <OnboardingWizard onComplete={() => {
              localStorage.setItem("buddy_onboarding_done", "true")
              setShow(false)
            }} />
          )}
        </AnimatePresence>
      )}
      <AnimatePresence>
        {showProfileNudge && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 max-w-sm w-full"
          >
            <div className="rounded-2xl border border-violet-500/30 bg-[hsl(222,47%,8%)] shadow-2xl shadow-black/40 p-4 flex gap-3">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/90">Personalise your signals</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Set up your investor profile to unlock sector-matched scores and opportunity discovery.
                </p>
                <Link
                  href="/settings/investor-profile"
                  onClick={dismissNudge}
                  className="inline-block mt-2 text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Set up now →
                </Link>
              </div>
              <button
                onClick={dismissNudge}
                className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

