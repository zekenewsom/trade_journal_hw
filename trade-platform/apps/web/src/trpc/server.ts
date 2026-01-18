import "server-only";
import { appRouter, createCallerFactory, createTRPCContext } from "@trade-platform/api";
import { auth0 } from "@/lib/auth0";
import { cache } from "react";

const createContext = cache(async () => {
  try {
    const session = await auth0.getSession();
    return createTRPCContext({
      userId: session?.user?.sub ?? null,
    });
  } catch {
    // Session not available, return null userId
    return createTRPCContext({
      userId: null,
    });
  }
});

const createCaller = createCallerFactory(appRouter);

/**
 * Server-side tRPC caller
 * Usage: const data = await api.analytics.summary()
 */
export const api = {
  analytics: {
    summary: async () => {
      const ctx = await createContext();
      const caller = createCaller(ctx);
      return caller.analytics.getAnalytics();
    },
  },
  trades: {
    list: async () => {
      const ctx = await createContext();
      const caller = createCaller(ctx);
      return caller.trades.list();
    },
    getById: async (input: { id: string | number }) => {
      const ctx = await createContext();
      const caller = createCaller(ctx);
      return caller.trades.getById(input);
    },
  },
};
