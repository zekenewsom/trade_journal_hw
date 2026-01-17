import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { emotions } from "@trade-platform/db/schema";

export const emotionsRouter = createTRPCRouter({
  /**
   * Get all emotions
   */
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(emotions).orderBy(emotions.name);
  }),

  /**
   * Create a new emotion
   */
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(emotions)
        .values({ name: input.name })
        .returning();

      return result[0];
    }),

  /**
   * Delete an emotion
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(emotions).where(eq(emotions.id, input.id));
      return { success: true };
    }),
});
