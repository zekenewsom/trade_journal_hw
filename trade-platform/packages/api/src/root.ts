import { createTRPCRouter } from "./trpc";
import { tradesRouter } from "./routers/trades";
import { transactionsRouter } from "./routers/transactions";
import { analyticsRouter } from "./routers/analytics";
import { emotionsRouter } from "./routers/emotions";
import { strategiesRouter } from "./routers/strategies";

export const appRouter = createTRPCRouter({
  trades: tradesRouter,
  transactions: transactionsRouter,
  analytics: analyticsRouter,
  emotions: emotionsRouter,
  strategies: strategiesRouter,
});

export type AppRouter = typeof appRouter;
