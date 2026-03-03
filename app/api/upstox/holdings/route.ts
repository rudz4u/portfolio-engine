import { NextResponse } from "next/server"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"

export async function GET() {
  const token = UPSTOX_CONFIG.accessToken
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "UPSTOX_ACCESS_TOKEN not configured. Set it in Netlify env vars." },
      { status: 400 }
    )
  }

  try {
    const res = await fetch(`${UPSTOX_CONFIG.baseUrl}/portfolio/long-term-holdings`, {
      headers: getUpstoxHeaders(token),
      next: { revalidate: 0 },
    })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: data.message || data.errors?.[0]?.message || "Upstox API error",
        },
        { status: res.status }
      )
    }

    return NextResponse.json({
      status: "success",
      data: data.data || [],
      count: (data.data || []).length,
    })
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Failed to reach Upstox API" },
      { status: 500 }
    )
  }
}
