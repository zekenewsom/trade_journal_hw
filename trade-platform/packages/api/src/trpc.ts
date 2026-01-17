import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@trade-platform/db/client";

/**
 * Context type for tRPC procedures
 */
export interface TRPCContext {
  userId: string | null;
  db: typeof db;
}

/**
 * Creates the tRPC context for each request
 */
export function createTRPCContext(opts: { userId: string | null }): TRPCContext {
  return {
    userId: opts.userId,
    db,
  };
}

/**
 * Initialize tRPC with superjson transformer for date/bigint support
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Creates a caller factory for server-side calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Router and procedure builders
 */
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});
