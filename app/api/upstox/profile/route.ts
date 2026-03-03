import { NextResponse } from "next/server"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"
import { resolveUpstoxToken } from "@/lib/upstox-token"

export async function GET() {
  const token = await resolveUpstoxToken()
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "No Upstox access token. Paste your token in Settings > Upstox Connection." },
      { status: 400 }
    )
  }

  try {
    const res = await fetch(`${UPSTOX_CONFIG.baseUrl}/user/profile`, {
      headers: getUpstoxHeaders(token),
      next: { revalidate: 0 },
    })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { status: "error", message: data.message || "Upstox API error" },
        { status: res.status }
      )
    }

    return NextResponse.json({ status: "success", data: data.data })
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Failed to reach Upstox API" },
      { status: 500 }
    )
  }
}
