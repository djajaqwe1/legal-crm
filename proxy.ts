import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_API_PATHS = new Set<string>(["/api/auth/login"]);

const PUBLIC_API_PREFIXES = ["/api/public/", "/api/portal/"];

// Portal routes that don't need authentication
const PORTAL_PUBLIC_PATHS = ["/portal", "/portal/login", "/portal/demo"];

function isPublicApi(pathname: string) {
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminSession(request: NextRequest) {
  const authCookie = request.cookies.get("admin_session");
  return authCookie?.value === "authorized";
}

function isPortalSession(request: NextRequest) {
  return !!request.cookies.get("portal_session")?.value;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Portal routes: protect private pages (but not login, demo, root)
  if (pathname.startsWith("/portal")) {
    const isPublicPortal = PORTAL_PUBLIC_PATHS.includes(pathname) ||
      pathname.startsWith("/portal/login") ||
      pathname.startsWith("/portal/demo");

    if (!isPublicPortal && !isPortalSession(request)) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    return NextResponse.next();
  }

  // Admin API routes: require admin session (except public APIs)
  if (pathname.startsWith("/api/") && !isPublicApi(pathname)) {
    if (!isAdminSession(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin pages: require admin session
  if (pathname.startsWith("/admin")) {
    if (!isAdminSession(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/portal", "/portal/:path*"],
};
