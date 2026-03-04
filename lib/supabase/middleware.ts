import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  // Refresh session — important for server components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  const protectedPaths = ["/dashboard", "/portfolio", "/analytics", "/watchlist", "/settings", "/assistant", "/recommendations", "/trade", "/sandbox"]
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/signin"
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from sign-in page
  if (user && request.nextUrl.pathname === "/signin") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Prevent Netlify Edge / Durable Cache from caching HTML responses.
  // The @netlify/plugin-nextjs overrides netlify.toml header rules for SSR/ISR
  // pages, so we must set these headers at the application level to ensure
  // deploy-time cache invalidation works correctly for ALL domains (including
  // custom domains like brokerai.rudz.in).
  supabaseResponse.headers.set("Cache-Control", "private, no-store, must-revalidate")
  supabaseResponse.headers.set("Netlify-CDN-Cache-Control", "no-store")

  return supabaseResponse
}
