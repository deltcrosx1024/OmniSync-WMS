import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwt, getBearerToken } from "./lib/auth";

const publicPaths = ["/", "/api/auth/login", "/api/callback", "/api/health"];
const apiPublicPaths = ["/api/auth/login", "/api/callback", "/api/health"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (apiPublicPaths.includes(pathname)) {
      return NextResponse.next();
    }

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", String(payload.sub));
    requestHeaders.set("x-user-name", payload.name || "");
    requestHeaders.set("x-user-role", payload.role || "");
    requestHeaders.set("x-is-superadmin", String(payload.isSuperAdmin || false));

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const token = request.cookies.get("gridflow-token")?.value;
  if (!token && pathname !== "/") {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (token) {
    const payload = verifyJwt(token);
    if (!payload) {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("gridflow-token");
      response.cookies.delete("gridflow-user");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};