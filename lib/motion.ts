/**
 * Shared Framer Motion animation variants for InvestBuddy AI.
 * Import { variants, transitions } in any client component.
 */

import type { Variants, Transition } from "framer-motion"

// ─── Transitions ────────────────────────────────────────────────────────────

export const easeOut: Transition = { type: "tween", ease: "easeOut", duration: 0.4 }
export const spring = (stiffness = 260, damping = 22): Transition => ({
  type: "spring",
  stiffness,
  damping,
})
export const springBouncy: Transition = { type: "spring", stiffness: 400, damping: 10 }
export const springSmooth: Transition = { type: "spring", stiffness: 200, damping: 25 }

// ─── Atomic variants ────────────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeOut },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: "tween", ease: "easeOut", duration: 0.45 } },
}

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -18 },
  show: { opacity: 1, y: 0, transition: easeOut },
}

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -28 },
  show: { opacity: 1, x: 0, transition: easeOut },
}

export const slideRight: Variants = {
  hidden: { opacity: 0, x: 28 },
  show: { opacity: 1, x: 0, transition: easeOut },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.93 },
  show: { opacity: 1, scale: 1, transition: springSmooth },
}

export const scaleInBouncy: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: springBouncy },
}

// ─── Container / stagger variants ───────────────────────────────────────────

export const staggerContainer = (staggerTime = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: {
      staggerChildren: staggerTime,
      delayChildren,
    },
  },
})

export const staggerFast = staggerContainer(0.05)
export const staggerMed  = staggerContainer(0.08)
export const staggerSlow = staggerContainer(0.12)

// ─── Interactive variants ────────────────────────────────────────────────────

export const cardHover = {
  rest: { y: 0, scale: 1, boxShadow: "0 0 0 0 transparent" },
  hover: {
    y: -6,
    scale: 1.012,
    boxShadow: "0 20px 48px -8px hsl(263 70% 62% / 0.18)",
    transition: springSmooth,
  },
}

export const buttonTap = {
  tap: { scale: 0.96 },
}

export const iconWobble = {
  rest: { rotate: 0 },
  hover: { rotate: [0, -8, 8, -4, 4, 0], transition: { duration: 0.5, ease: "easeInOut" } },
}

export const iconBounce = {
  rest: { y: 0 },
  hover: { y: [-2, 2, -1, 0], transition: { duration: 0.4, ease: "easeInOut" } },
}

// ─── Scroll-reveal helper (use with whileInView) ─────────────────────────────

/** Standard viewport settings for whileInView animations */
export const viewport = { once: true, margin: "-80px" } as const

// ─── Progress / bar animation ───────────────────────────────────────────────

/** Use as initial/animate on a scaleX bar; set transformOrigin: "left" */
export const barReveal = (targetScale: number): object => ({
  initial: { scaleX: 0, opacity: 0 },
  animate: { scaleX: targetScale, opacity: 1 },
  transition: { ...springSmooth, delay: 0.1 },
})

// ─── Modal / overlay ─────────────────────────────────────────────────────────

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 24 },
  show: { opacity: 1, scale: 1, y: 0, transition: springSmooth },
  exit: { opacity: 0, scale: 0.95, y: 12, transition: { duration: 0.18 } },
}

// ─── Page transition (use in layout AnimatePresence) ─────────────────────────

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}
