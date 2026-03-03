import { NextResponse } from "next/server"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"

export async function GET() {
  const token = UPSTOX_CONFIG.accessToken
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "UPSTOX_ACCESS_TOKEN not configured" },
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
