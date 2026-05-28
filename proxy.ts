import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_API_PATHS = new Set<string>(["/api/auth/login"]);

const PUBLIC_API_PREFIXES = ["/api/public/", "/api/portal/"];

function isPublicApi(pathname: string) {
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminSession(request: NextRequest) {
  const authCookie = request.cookies.get("admin_session");
  return authCookie?.value === "authorized";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/portal")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !isPublicApi(pathname)) {
    if (!isAdminSession(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!isAdminSession(request)) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/portal", "/portal/:path*"],
};
