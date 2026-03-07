import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * DELETE /api/profile/delete-account
 * Permanently deletes the user's account and all associated data
 * DPDPA "Right to Erasure" / "Right to be Forgotten"
 */
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = await createAdminClient()

  try {
    const userId = user.id

    console.log(`[delete-account] Starting deletion for user ${userId}`)

    // 1. Delete all user-related data from the application tables
    // Order matters: delete child records before parent records

    // Delete chat history
    await admin.from("chat_messages").delete().eq("user_id", userId)
    console.log(`[delete-account] Deleted chat_messages`)

    // Delete orders
    await admin.from("orders").delete().eq("user_id", userId)
    console.log(`[delete-account] Deleted orders`)

    // Delete portfolio snapshots
    await admin.from("portfolio_snapshots").delete().eq("user_id", userId)
    console.log(`[delete-account] Deleted portfolio_snapshots`)

    // Get all portfolios for the user
    const { data: portfolios } = await admin
      .from("portfolios")
      .select("id")
      .eq("user_id", userId)

    if (portfolios?.length) {
      // Delete holdings for each portfolio
      for (const portfolio of portfolios) {
        await admin.from("holdings").delete().eq("portfolio_id", portfolio.id)
      }
      console.log(`[delete-account] Deleted holdings`)

      // Delete portfolios
      await admin.from("portfolios").delete().eq("user_id", userId)
      console.log(`[delete-account] Deleted portfolios`)
    }

    // Get all watchlists for the user
    const { data: watchlists } = await admin
      .from("watchlists")
      .select("id")
      .eq("user_id", userId)

    if (watchlists?.length) {
      // Delete watchlist items
      for (const watchlist of watchlists) {
        await admin.from("watchlist_items").delete().eq("watchlist_id", watchlist.id)
      }
      console.log(`[delete-account] Deleted watchlist_items`)

      // Delete watchlists
      await admin.from("watchlists").delete().eq("user_id", userId)
      console.log(`[delete-account] Deleted watchlists`)
    }

    // Delete user settings
    await admin.from("user_settings").delete().eq("user_id", userId)
    console.log(`[delete-account] Deleted user_settings`)

    // 2. Delete the auth user
    // Note: This removes the user from Supabase Auth
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error(`[delete-account] Failed to delete auth user: ${deleteAuthError.message}`)
      return NextResponse.json(
        {
          error: `Failed to delete account: ${deleteAuthError.message}`,
        },
        { status: 500 }
      )
    }

    console.log(`[delete-account] Successfully deleted user ${userId}`)

    // Return success response
    return NextResponse.json({
      ok: true,
      message:
        "Account deletion has been initiated. All your personal data has been permanently deleted in accordance with DPDPA.",
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[delete-account] Error: ${errorMessage}`)
    return NextResponse.json(
      {
        error: `Failed to delete account: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}
