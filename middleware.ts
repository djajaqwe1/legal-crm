import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "admin_session";
const SESSION_VALUE = "authorized";
const PORTAL_COOKIE = "portal_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin routes (except login page itself)
  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get(SESSION_COOKIE);
    if (session?.value !== SESSION_VALUE) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect /portal private routes
  if (
    pathname.startsWith("/portal") &&
    !pathname.startsWith("/portal/login") &&
    !pathname.startsWith("/portal/demo") &&
    pathname !== "/portal" &&
    pathname !== "/portal/"
  ) {
    const portalSession = request.cookies.get(PORTAL_COOKIE);
    if (!portalSession?.value) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
  ],
};
