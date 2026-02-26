import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/signin', '/api', '/favicon.ico', '/_next']

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p))) return true
  return false
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  // Check common Supabase auth cookies. If none present, redirect to /signin
  const cookies = req.cookies
  const tokenCandidates = [
    cookies.get('sb-access-token')?.value,
    cookies.get('sb-refresh-token')?.value,
    cookies.get('supabase-auth-token')?.value,
    cookies.get('sb:token')?.value,
  ]

  const hasAuth = tokenCandidates.some(Boolean)
  if (!hasAuth) {
    const url = req.nextUrl.clone()
    url.pathname = '/signin'
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/settings/:path*', '/sandbox/:path*', '/dashboard'],
}
