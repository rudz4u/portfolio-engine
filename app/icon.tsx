import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#080c18",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Brand ring + chart line — matches investbuddy_favicon_transparent.svg */}
        <svg width="26" height="26" viewBox="0 0 256 256">
          <defs>
            <linearGradient id="r" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <circle cx="128" cy="128" r="92" stroke="url(#r)" strokeWidth="16" fill="none" />
          <path d="M70 150 L110 115 L140 130 L175 80" stroke="url(#r)" strokeWidth="10" fill="none" strokeLinecap="round" />
          <circle cx="70" cy="150" r="6" fill="#a78bfa" />
          <circle cx="110" cy="115" r="6" fill="#38bdf8" />
          <circle cx="140" cy="130" r="6" fill="#34d399" />
          <circle cx="175" cy="80" r="6" fill="#a78bfa" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
