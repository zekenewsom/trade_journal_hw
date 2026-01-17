import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@trade-platform/api";
import { getSession } from "@auth0/nextjs-auth0";
import { cookies } from "next/headers";

const handler = async (req: Request) => {
  // Pre-await cookies for Next.js 15 compatibility
  await cookies();

  let userId: string | null = null;
  try {
    const session = await getSession();
    userId = session?.user?.sub ?? null;
  } catch {
    // Session not available
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ userId }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            );
          }
        : undefined,
  });
};

export { handler as GET, handler as POST };
