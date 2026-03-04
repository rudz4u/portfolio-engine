"use client"

import { motion } from "framer-motion"

interface BetaBadgeProps {
  className?: string
  tooltip?: boolean
}

export function BetaBadge({ className = "", tooltip = true }: BetaBadgeProps) {
  return (
    <motion.span
      whileHover={{ scale: 1.06 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
      title={tooltip ? "InvestBuddy AI is in beta — features and scoring models are actively improving." : undefined}
      className={`inline-flex items-center gap-1 bg-amber-400/10 border border-amber-400/25 text-amber-400 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest cursor-default select-none ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
      </span>
      BETA
    </motion.span>
  )
}
