"use client"

import { motion } from "framer-motion"

interface BuddyMascotProps {
  size?: number
  animate?: boolean
  className?: string
}

export function BuddyMascot({ size = 96, animate = true, className = "" }: BuddyMascotProps) {
  return (
    <motion.div
      className={`inline-flex items-center justify-center ${className}`}
      initial={animate ? { scale: 0.6, opacity: 0 } : undefined}
      animate={animate ? { scale: 1, opacity: 1 } : undefined}
      transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.05 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Buddy mascot"
      >
        {/* Glow filter */}
        <defs>
          <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6d28d9" />
          </radialGradient>
          <radialGradient id="eyeGrad" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#38bdf8" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Antenna base */}
        <rect x="45" y="6" width="6" height="12" rx="3" fill="#7c3aed" />
        {/* Antenna tip */}
        <motion.circle
          cx="48" cy="5" r="4"
          fill="#c4b5fd"
          filter="url(#glow)"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Head */}
        <rect x="14" y="18" width="68" height="58" rx="18" fill="url(#bodyGrad)" />

        {/* Ear nubs */}
        <rect x="8" y="34" width="8" height="14" rx="4" fill="#7c3aed" />
        <rect x="80" y="34" width="8" height="14" rx="4" fill="#7c3aed" />

        {/* Screen face area */}
        <rect x="22" y="26" width="52" height="40" rx="12" fill="#0f172a" opacity="0.85" />

        {/* Eyes */}
        <motion.circle
          cx="37" cy="43" r="7"
          fill="url(#eyeGrad)"
          animate={{ scaleY: [1, 0.15, 1] }}
          transition={{ duration: 0.12, delay: 3, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
        />
        <motion.circle
          cx="59" cy="43" r="7"
          fill="url(#eyeGrad)"
          animate={{ scaleY: [1, 0.15, 1] }}
          transition={{ duration: 0.12, delay: 3, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
        />
        {/* Eye pupils */}
        <motion.circle cx="38" cy="42" r="3" fill="#0c4a6e"
          animate={{ x: [0, 1, 0, -1, 0], y: [0, 0, 1, 0, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle cx="60" cy="42" r="3" fill="#0c4a6e"
          animate={{ x: [0, 1, 0, -1, 0], y: [0, 0, 1, 0, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Eye shine */}
        <circle cx="40" cy="40.5" r="1.5" fill="white" opacity="0.9" />
        <circle cx="62" cy="40.5" r="1.5" fill="white" opacity="0.9" />

        {/* Smile */}
        <motion.path
          d="M34 56 Q48 64 62 56"
          stroke="#34d399"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          animate={{ d: ["M34 56 Q48 64 62 56", "M34 57 Q48 66 62 57", "M34 56 Q48 64 62 56"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Chin detail */}
        <rect x="36" y="76" width="24" height="8" rx="4" fill="#7c3aed" opacity="0.8" />
        <circle cx="44" cy="80" r="2.5" fill="#a78bfa" />
        <circle cx="52" cy="80" r="2.5" fill="#a78bfa" />
      </svg>
    </motion.div>
  )
}
