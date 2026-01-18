import type { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

export default async function middleware(req: NextRequest) {
  // Auth0 v4 middleware handles all auth routes automatically
  return auth0.middleware(req);
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
