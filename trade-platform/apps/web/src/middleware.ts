import { withMiddlewareAuthRequired, getSession } from "@auth0/nextjs-auth0/edge";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/trades",
  "/analytics",
  "/import",
  "/integrations",
  "/settings",
];

// Public routes that don't require authentication
const publicRoutes = ["/", "/api/auth"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if this is a public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // If it's a protected route, require authentication
  if (isProtectedRoute) {
    // Use Auth0's middleware to check authentication
    const authMiddleware = withMiddlewareAuthRequired({
      returnTo: pathname,
    });
    return authMiddleware(request);
  }

  // For the homepage, check if user is logged in and redirect to dashboard
  if (pathname === "/") {
    try {
      const response = NextResponse.next();
      const session = await getSession(request, response);
      if (session?.user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      // No session, continue to homepage
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
