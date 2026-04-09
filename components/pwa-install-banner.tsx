"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

type InstallMode = "android" | "ios" | null

const DISMISSED_KEY = "pwa-banner-dismissed-until"
const DISMISS_DAYS = 7 // re-show after 7 days

function isIOS() {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isAndroidChrome() {
  if (typeof navigator === "undefined") return false
  return /android/i.test(navigator.userAgent) && /chrome/i.test(navigator.userAgent)
}

function isStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  )
}

function isDismissed() {
  try {
    const until = localStorage.getItem(DISMISSED_KEY)
    if (!until) return false
    return Date.now() < parseInt(until, 10)
  } catch {
    return false
  }
}

function saveDismiss() {
  try {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISSED_KEY, String(until))
  } catch {
    // ignore
  }
}

export function PWAInstallBanner() {
  const [mode, setMode] = useState<InstallMode>(null)
  const [visible, setVisible] = useState(false)
  const [showIOSTip, setShowIOSTip] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deferredPromptRef = useRef<any>(null)

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isStandalone() || isDismissed()) return

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e
      if (isAndroidChrome()) {
        setMode("android")
        setVisible(true)
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)

    // iOS doesn't fire beforeinstallprompt — detect manually
    if (isIOS()) {
      setMode("ios")
      setVisible(true)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (mode === "ios") {
      setShowIOSTip((v) => !v)
      return
    }
    const prompt = deferredPromptRef.current
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") {
      dismiss()
    }
  }

  const dismiss = () => {
    setVisible(false)
    saveDismiss()
  }

  if (!visible) return null

  return (
    <>
      {/* Backdrop blur for iOS tip */}
      {showIOSTip && (
        <div
          className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm"
          onClick={() => setShowIOSTip(false)}
        />
      )}

      {/* Main banner — slides up from bottom */}
      <div
        role="banner"
        aria-label="Install InvestBuddy AI app"
        className="fixed bottom-0 left-0 right-0 z-[9998] px-4 pb-safe animate-in slide-in-from-bottom-4 duration-300"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#0d1224]/95 shadow-2xl backdrop-blur-md overflow-hidden">
          {/* Accent gradient bar */}
          <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-indigo-400 to-violet-500" />

          <div className="flex items-center gap-3 p-4">
            {/* App icon */}
            <div className="shrink-0 rounded-xl overflow-hidden w-12 h-12 bg-[#1a1f3d] flex items-center justify-center border border-white/10">
              <Image
                src="/Logos/investbuddyai_app_icon.svg"
                alt="InvestBuddy AI"
                width={40}
                height={40}
              />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">
                Get the full app experience
              </p>
              <p className="text-xs text-white/55 mt-0.5 leading-snug">
                {mode === "ios"
                  ? "Add to Home Screen for instant access, offline mode & more."
                  : "Install InvestBuddy AI for instant access & faster performance."}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstall}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-xs font-semibold px-3 py-2 transition-colors"
              >
                {mode === "ios" ? "How to" : "Install"}
              </button>
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="rounded-lg p-2 text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* iOS step-by-step tip (expands inline) */}
          {showIOSTip && (
            <div className="px-4 pb-4 pt-0">
              <div className="rounded-xl bg-white/5 border border-white/8 p-3 space-y-2">
                <p className="text-xs font-semibold text-white/80 mb-1">Add to Home Screen</p>
                {[
                  { step: "1", icon: "⬆️", text: 'Tap the Share button in Safari\'s toolbar' },
                  { step: "2", icon: "➕", text: 'Scroll down and tap "Add to Home Screen"' },
                  { step: "3", icon: "✅", text: 'Tap "Add" — the app icon appears on your Home Screen' },
                ].map(({ step, icon, text }) => (
                  <div key={step} className="flex items-start gap-2">
                    <span className="text-sm leading-none mt-0.5">{icon}</span>
                    <p className="text-xs text-white/60 leading-snug">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
