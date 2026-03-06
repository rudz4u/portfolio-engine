"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

interface BrandLoaderProps {
  /** Full-screen overlay mode (default: false — inline block loader) */
  fullscreen?: boolean
  /** Message below the logo */
  message?: string
}

const loadingMessages = [
  "Crunching your numbers…",
  "Powering up the quant engine…",
  "Fetching market data…",
  "Analysing your portfolio…",
  "Almost there…",
]

export function BrandLoader({ fullscreen = false, message }: BrandLoaderProps) {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    if (!message) {
      const t = setInterval(() => setMsgIndex((i) => (i + 1) % loadingMessages.length), 1800)
      return () => clearInterval(t)
    }
  }, [message])

  const displayMsg = message ?? loadingMessages[msgIndex]

  const inner = (
    <div className="flex flex-col items-center justify-center gap-6 select-none">
      {/* Glow ring + mascot */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulsing ring */}
        <motion.div
          className="absolute rounded-full border border-primary/30"
          style={{ width: 120, height: 120 }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Middle ring */}
        <motion.div
          className="absolute rounded-full border border-primary/20"
          style={{ width: 90, height: 90 }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
        {/* Mascot */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 16 }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image
              src="/Logos/investbuddy_mascot_logo.svg"
              alt="InvestBuddy AI"
              width={72}
              height={72}
              priority
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
      >
        <Image
          src="/Logos/investbuddy_wordmark.svg"
          alt="InvestBuddy AI"
          width={160}
          height={30}
          priority
          className="opacity-90"
        />
      </motion.div>

      {/* Rotating dots progress */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Cycling message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={displayMsg}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
          className="text-xs text-muted-foreground text-center max-w-[200px]"
        >
          {displayMsg}
        </motion.p>
      </AnimatePresence>
    </div>
  )

  if (!fullscreen) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center">
        {inner}
      </div>
    )
  }

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {inner}
    </motion.div>
  )
}

/** Splash overlay shown on initial app load — manages its own lifecycle */
export function AppSplash() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2200)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && <BrandLoader fullscreen />}
    </AnimatePresence>
  )
}
