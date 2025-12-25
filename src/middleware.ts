import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // Define public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/privacy', '/terms', '/api/auth']
  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )

  // Redirect to login if not authenticated and not on public route
  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to library if authenticated and on login page
  if (isLoggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/library', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ],
}
