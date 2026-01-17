import { handleAuth, handleLogin } from "@auth0/nextjs-auth0";
import type { NextRequest } from "next/server";

const handler = handleAuth({
  login: handleLogin({
    returnTo: "/dashboard",
  }),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ auth0: string }> }
) {
  const params = await context.params;
  // Create a context object that handleAuth expects
  return handler(request, { params });
}
