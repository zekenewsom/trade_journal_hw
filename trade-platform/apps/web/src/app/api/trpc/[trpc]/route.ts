import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@trade-platform/api";
import { auth0 } from "@/lib/auth0";

const handler = async (req: Request) => {
  let userId: string | null = null;
  try {
    const session = await auth0.getSession();
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
