"use client"

import { useEffect, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { OnboardingWizard } from "@/components/onboarding-wizard"

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Fast-path: if already done (stored locally), skip the API call entirely.
    // This prevents the wizard from re-triggering on every page navigation.
    if (typeof window !== "undefined" && localStorage.getItem("buddy_onboarding_done") === "true") {
      setChecked(true)
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
    </>
  )
}
