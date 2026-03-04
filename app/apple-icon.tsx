import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="96" height="96" viewBox="0 0 24 24" fill="white">
          <path d="M13 2L4.09 12.96H11L10 22L20 10.04H13.5L15 2H13Z" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
