import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

const PROTECTED_PATHS = ['/dashboard', '/profile', '/settings', '/sandbox', '/assistant', '/recommendations']

function isProtected(pathname: string) {
  return PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Refresh the session for every request (updates cookies)
  const { user, supabaseResponse } = await updateSession(req)

  // If the path is protected and there's no user, redirect to /signin
  if (isProtected(pathname) && !user) {
    const url = req.nextUrl.clone()
    url.pathname = '/signin'
    url.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/ (API routes handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
