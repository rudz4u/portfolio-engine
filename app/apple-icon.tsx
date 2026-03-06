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
          borderRadius: 42,
          background: "linear-gradient(135deg, #111827 0%, #0F172A 42%, #020617 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Purple halo */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 42,
            background: "radial-gradient(circle at 45% 45%, rgba(76,29,149,0.55) 0%, transparent 65%)",
            display: "flex",
          }}
        />
        {/* Brand ring + chart — matches investbuddyai_app_icon.svg */}
        <svg width="128" height="128" viewBox="0 0 1024 1024">
          <defs>
            <linearGradient id="ring" x1="250" y1="236" x2="774" y2="782" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#A78BFA" />
              <stop offset="0.5" stopColor="#38BDF8" />
              <stop offset="1" stopColor="#34D399" />
            </linearGradient>
            <linearGradient id="line" x1="332" y1="624" x2="676" y2="366" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#A78BFA" />
              <stop offset="0.5" stopColor="#38BDF8" />
              <stop offset="1" stopColor="#86EFAC" />
            </linearGradient>
          </defs>
          <circle cx="512" cy="512" r="280" stroke="url(#ring)" strokeWidth="22" fill="none" />
          <circle cx="512" cy="512" r="210" stroke="#8B5CF6" strokeOpacity="0.18" strokeWidth="6" fill="none" />
          <path d="M332 612L430 520L526 556L650 368L734 412" stroke="url(#line)" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="332" cy="612" r="24" fill="#DDD6FE" />
          <circle cx="430" cy="520" r="24" fill="#BAE6FD" />
          <circle cx="526" cy="556" r="24" fill="#DDD6FE" />
          <circle cx="650" cy="368" r="24" fill="#BAE6FD" />
          <circle cx="512" cy="512" r="42" fill="#0F172A" stroke="#A78BFA" strokeWidth="10" />
          <circle cx="512" cy="512" r="14" fill="#34D399" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
