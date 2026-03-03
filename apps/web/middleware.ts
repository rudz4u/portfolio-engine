import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

/**
 * Next.js Edge Middleware
 * Runs on every request to refresh the Supabase auth session cookie.
 * Without this, the auth token can expire mid-session without refreshing.
 */
export async function middleware(request: NextRequest) {
    const { user, supabaseResponse } = await updateSession(request)

    const { pathname } = request.nextUrl

    // Protect dashboard, settings, recommendations, assistant, sandbox
    const protectedPaths = ['/dashboard', '/settings', '/recommendations', '/assistant', '/sandbox']
    const isProtected = protectedPaths.some(p => pathname.startsWith(p))

    if (isProtected && !user) {
        const signInUrl = new URL('/signin', request.url)
        signInUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(signInUrl)
    }

    // If already signed in and visiting signin/root, redirect to dashboard
    if (user && (pathname === '/signin' || pathname === '/')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all routes except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - API routes (handled separately)
         */
        '/((?!_next/static|_next/image|favicon\\.ico|api/).*)',
    ],
}
