import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { strategies } from "@trade-platform/db/schema";

export const strategiesRouter = createTRPCRouter({
  /**
   * Get all strategies
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    // In production, filter by org_id
    return ctx.db.select().from(strategies).orderBy(strategies.name);
  }),

  /**
   * Create a new strategy
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // For org_id, we'd need to look up the user's org
      const placeholderOrgId = "00000000-0000-0000-0000-000000000000";

      const result = await ctx.db
        .insert(strategies)
        .values({
          orgId: placeholderOrgId,
          name: input.name,
          description: input.description,
        })
        .returning();

      return result[0];
    }),

  /**
   * Update a strategy
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      await ctx.db
        .update(strategies)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(strategies.id, id));

      return { success: true };
    }),

  /**
   * Delete a strategy
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(strategies).where(eq(strategies.id, input.id));
      return { success: true };
    }),
});
