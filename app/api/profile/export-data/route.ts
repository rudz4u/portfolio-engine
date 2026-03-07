import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Collect all user data from various tables
    const dataExport: Record<string, unknown> = {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        phone: user.user_metadata?.phone || null,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      export_date: new Date().toISOString(),
      export_version: "1.0",
    }

    // Fetch user settings
    const { data: settingsData } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (settingsData) {
      dataExport.settings = settingsData
    }

    // Fetch portfolios
    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", user.id)

    if (portfolios?.length) {
      dataExport.portfolios = portfolios

      // Fetch holdings for each portfolio
      const holdingsData: Record<string, unknown[]> = {}
      for (const portfolio of portfolios) {
        const { data: holdings } = await supabase
          .from("holdings")
          .select("*")
          .eq("portfolio_id", portfolio.id)

        if (holdings?.length) {
          holdingsData[portfolio.id] = holdings
        }
      }
      if (Object.keys(holdingsData).length > 0) {
        dataExport.holdings_by_portfolio = holdingsData
      }
    }

    // Fetch watchlists
    const { data: watchlists } = await supabase
      .from("watchlists")
      .select("*")
      .eq("user_id", user.id)

    if (watchlists?.length) {
      dataExport.watchlists = watchlists

      // Fetch watchlist items
      const itemsData: Record<string, unknown[]> = {}
      for (const watchlist of watchlists) {
        const { data: items } = await supabase
          .from("watchlist_items")
          .select("*")
          .eq("watchlist_id", watchlist.id)

        if (items?.length) {
          itemsData[watchlist.id] = items
        }
      }
      if (Object.keys(itemsData).length > 0) {
        dataExport.watchlist_items_by_id = itemsData
      }
    }

    // Fetch orders
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)

    if (orders?.length) {
      dataExport.orders = orders
    }

    // Fetch chat history
    const { data: chatHistory } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)

    if (chatHistory?.length) {
      dataExport.chat_history = chatHistory
    }

    // Fetch portfolio snapshots
    const { data: snapshots } = await supabase
      .from("portfolio_snapshots")
      .select("*")
      .eq("user_id", user.id)

    if (snapshots?.length) {
      dataExport.portfolio_snapshots = snapshots
    }

    // Create JSON response as file download
    const jsonString = JSON.stringify(dataExport, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="investbuddy-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("Error exporting data:", error)
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    )
  }
}
