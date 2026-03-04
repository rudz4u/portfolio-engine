"use client"

import { useEffect, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { OnboardingWizard } from "@/components/onboarding-wizard"

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const prefs = data?.preferences ?? {}
        if (prefs.onboarding_completed !== "true") {
          // Small delay so dashboard content loads first
          setTimeout(() => setShow(true), 800)
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
            <OnboardingWizard onComplete={() => setShow(false)} />
          )}
        </AnimatePresence>
      )}
    </>
  )
}
