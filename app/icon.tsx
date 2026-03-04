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
          background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M13 2L4.09 12.96H11L10 22L20 10.04H13.5L15 2H13Z" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
