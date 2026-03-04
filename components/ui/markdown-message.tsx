"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import React from "react"

interface MarkdownMessageProps {
  content: string
  className?: string
}

/** Recursively extract plain text from a React node (for signal detection) */
function getTextContent(node: React.ReactNode): string {
  if (typeof node === "string") return node
  if (Array.isArray(node)) return node.map(getTextContent).join("")
  if (React.isValidElement(node))
    return getTextContent((node.props as { children?: React.ReactNode }).children)
  return ""
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={cn("select-text space-y-0.5", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── H1 ─────────────────────────────────────────────────────────
          h1: ({ children }) => (
            <h1 className="text-lg font-bold gradient-text mt-3 mb-2 first:mt-0">
              {children}
            </h1>
          ),

          // ── H2 – main section titles ────────────────────────────────────
          h2: ({ children }) => (
            <div className="mt-6 mb-3 first:mt-0">
              <h2 className="text-[0.95rem] font-bold gradient-text pb-2 border-b border-violet-500/20 leading-snug">
                {children}
              </h2>
            </div>
          ),

          // ── H3 – subsection headers ─────────────────────────────────────
          h3: ({ children }) => (
            <div className="mt-4 mb-2 flex items-center gap-2">
              <span className="block w-0.5 h-[1.05rem] rounded-full bg-gradient-to-b from-violet-400 to-blue-500 shrink-0" />
              <h3 className="text-[0.8rem] font-semibold text-foreground/90 tracking-wide uppercase">
                {children}
              </h3>
            </div>
          ),

          // ── Paragraphs ──────────────────────────────────────────────────
          p: ({ children }) => (
            <p className="text-sm text-foreground/80 leading-relaxed mt-0 mb-3 last:mb-0">
              {children}
            </p>
          ),

          // ── Bold ────────────────────────────────────────────────────────
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),

          // ── Italic / disclaimer text ─────────────────────────────────────
          em: ({ children }) => (
            <em className="not-italic text-muted-foreground text-xs">
              {children}
            </em>
          ),

          // ── Unordered lists ─────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="my-3 space-y-2 pl-0 list-none">
              {children}
            </ul>
          ),

          // ── Ordered lists ───────────────────────────────────────────────
          ol: ({ children }) => (
            <ol className="my-3 space-y-2 pl-0 list-none counter-reset-li">
              {children}
            </ol>
          ),

          // ── List items – color bullet by signal keyword ─────────────────
          li: ({ children }) => {
            const text = getTextContent(children)
            const isBuy     = /\bBUY\b|🟢/i.test(text)
            const isSell    = /\bSELL\b|🔴/i.test(text)
            const isWarning = /⚠️|overbought/i.test(text)
            const isOversold = /oversold|🔄/i.test(text)

            const bulletCls = isBuy
              ? "bg-emerald-400 shadow-[0_0_6px_hsl(142_69%_44%/0.8)]"
              : isSell
              ? "bg-red-400 shadow-[0_0_6px_hsl(0_72%_54%/0.7)]"
              : isWarning
              ? "bg-amber-400 shadow-[0_0_6px_hsl(38_90%_50%/0.7)]"
              : isOversold
              ? "bg-sky-400 shadow-[0_0_6px_hsl(210_80%_55%/0.7)]"
              : "bg-violet-400/60"

            return (
              <li className="flex items-start gap-2.5 text-sm text-foreground/80">
                <span
                  className={cn(
                    "mt-[0.44rem] h-1.5 w-1.5 rounded-full shrink-0",
                    bulletCls
                  )}
                />
                <span className="flex-1 leading-loose">{children}</span>
              </li>
            )
          },

          // ── Horizontal rule – gradient divider ──────────────────────────
          hr: () => (
            <div className="my-5">
              <div className="h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
            </div>
          ),

          // ── Inline code ─────────────────────────────────────────────────
          code: ({ children }) => (
            <code className="bg-secondary/80 text-violet-300 text-[0.75em] px-1.5 py-0.5 rounded font-mono">
              {children}
            </code>
          ),

          // ── Pre / code blocks ───────────────────────────────────────────
          pre: ({ children }) => (
            <pre className="bg-secondary/70 border border-border/60 text-xs rounded-lg p-3 overflow-x-auto my-2 font-mono">
              {children}
            </pre>
          ),

          // ── Blockquotes ─────────────────────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-violet-500/50 pl-3 my-2 text-muted-foreground text-xs italic">
              {children}
            </blockquote>
          ),

          // ── Links ───────────────────────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-violet-400 underline underline-offset-2 hover:text-violet-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),

          // ── Tables (GFM) ─────────────────────────────────────────────────
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-xs border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-secondary/80 text-muted-foreground">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-1.5 text-left font-semibold border border-border/60 text-foreground/70 text-[0.7rem] uppercase tracking-wide">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 border border-border/40 text-foreground/80">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-secondary/30">
              {children}
            </tr>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
