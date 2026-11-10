import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { parseSessionToken } from "@/lib/auth"

const PUBLIC_FILE = /\.(.*)$/

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/_next") || pathname.startsWith("/static")) {
    return NextResponse.next()
  }

  if (PUBLIC_FILE.test(pathname)) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api")) {
    // Allow API routes to handle their own auth, except we still require login for protected endpoints within handlers
    return NextResponse.next()
  }

  const sessionToken = request.cookies.get("heritedge-session")?.value
  const session = parseSessionToken(sessionToken)
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/login/")

  if (!session) {
    if (isAuthRoute) {
      return NextResponse.next()
    }

    const loginUrl = new URL("/login", request.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete("heritedge-session")
    return response
  }

  if (session && isAuthRoute) {
    const redirectUrl = new URL("/preferences", request.url)
    redirectUrl.searchParams.set("from", "/chatbot")
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/:path*"],
}
