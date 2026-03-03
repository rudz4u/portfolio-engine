import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

const PROTECTED_PATHS = ['/dashboard', '/profile', '/settings', '/sandbox', '/assistant', '/recommendations', '/analytics']

function isProtected(pathname: string) {
  return PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Refresh the Supabase session cookie on every request
  const { user, supabaseResponse } = await updateSession(req)

  // If the path is protected and there's no user, redirect to /signin
  if (isProtected(pathname) && !user) {
    const url = req.nextUrl.clone()
    url.pathname = '/signin'
    url.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  // If user is already signed in and visits signin or root, redirect to dashboard
  if (user && (pathname === '/signin' || pathname === '/')) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api/ (API routes handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
