import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "InvestBuddy AI — AI-Powered Equity Management for Indian Markets"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#080c18",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background gradient blobs */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.28) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
          }}
        />

        {/* Grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "68px 80px",
            flex: 1,
            zIndex: 1,
          }}
        >
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 52 }}>
            {/* Orb icon */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 40px rgba(139,92,246,0.5)",
              }}
            >
              {/* Lightning bolt SVG */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M13 2L4.09 12.96H11L10 22L20 10.04H13.5L15 2H13Z" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  background: "linear-gradient(90deg, #a78bfa, #60a5fa)",
                  backgroundClip: "text",
                  color: "transparent",
                  letterSpacing: "-0.5px",
                }}
              >
                InvestBuddy AI
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                investbuddyai.com
              </span>
            </div>
            {/* Beta pill */}
            <div
              style={{
                marginLeft: 12,
                background: "rgba(251,191,36,0.1)",
                border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: 99,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 700,
                color: "#fbbf24",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              BETA
            </div>
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: 54,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.07,
              letterSpacing: "-1.5px",
              marginBottom: 20,
              maxWidth: 680,
            }}
          >
            AI-Powered Equity
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #a78bfa 0%, #60a5fa 60%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Management
            </span>
            {" "}for India
          </div>

          {/* Subline */}
          <div
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.45)",
              marginBottom: 48,
              maxWidth: 580,
              lineHeight: 1.5,
            }}
          >
            Quant signals · AI recommendations · Live portfolio tracking · Multi-broker support
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { text: "RSI · MACD · Bollinger", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
              { text: "AI Buy/Sell Signals", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
              { text: "NSE/BSE Live Data", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
              { text: "Multi-broker OAuth", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
            ].map((pill) => (
              <div
                key={pill.text}
                style={{
                  background: pill.bg,
                  border: `1px solid ${pill.color}40`,
                  borderRadius: 99,
                  padding: "8px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: pill.color,
                }}
              >
                {pill.text}
              </div>
            ))}
          </div>
        </div>

        {/* Right side mock card */}
        <div
          style={{
            position: "absolute",
            right: 72,
            top: "50%",
            transform: "translateY(-50%)",
            width: 280,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            backdropFilter: "blur(20px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Portfolio Score
            </span>
            <span style={{ fontSize: 11, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 99 }}>
              ↑ Live
            </span>
          </div>

          {/* Big score */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>74</span>
            <span style={{ fontSize: 16, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>/100</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Momentum", score: 82, color: "#8b5cf6" },
              { label: "Valuation", score: 67, color: "#3b82f6" },
              { label: "Advisory",  score: 78, color: "#10b981" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: row.color }}>{row.score}</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                  <div style={{ height: "100%", width: `${row.score}%`, background: row.color, borderRadius: 99, opacity: 0.8 }} />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 4,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 700,
              color: "#10b981",
              textAlign: "center",
            }}
          >
            STRONG BUY
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            padding: "16px 80px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
            © 2026 InvestBuddy AI · investbuddyai.com
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
            Upstox · Zerodha · More brokers coming
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
