import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { trades, transactions, tradeEmotions, users, organizations, orgMembers } from "@trade-platform/db/schema";
import {
  updateTradeMetadataSchema,
  updateMarkPriceSchema,
} from "@trade-platform/core/validation";
import { calculateTradePnlFifo } from "@trade-platform/core/pnl";
import { toDecimal, toString } from "@trade-platform/core/financial";
import type { TradeData, TransactionData } from "@trade-platform/core";

/**
 * Helper to get user's organization ID
 */
async function getUserOrgId(db: any, externalUserId: string): Promise<string | null> {
  // Find the user by external ID
  const user = await db
    .select()
    .from(users)
    .where(eq(users.externalId, externalUserId))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  const userId = user[0].id;

  // Check if user has an org via org_members
  const membership = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1);

  if (membership.length > 0) {
    return membership[0].orgId;
  }

  // Check if user owns an org
  const ownedOrg = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.ownerId, userId))
    .limit(1);

  if (ownedOrg.length > 0) {
    return ownedOrg[0].id;
  }

  return null;
}

export const tradesRouter = createTRPCRouter({
  /**
   * Get all trades for the current user's organization
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    // Get user's organization
    const orgId = await getUserOrgId(ctx.db, ctx.userId!);

    if (!orgId) {
      return []; // No org = no trades
    }

    const allTrades = await ctx.db
      .select()
      .from(trades)
      .where(eq(trades.orgId, orgId))
      .orderBy(desc(trades.openDatetime));

    // Fetch transactions for each trade and calculate P&L
    const tradesWithPnl = await Promise.all(
      allTrades.map(async (trade) => {
        const tradeTransactions = await ctx.db
          .select()
          .from(transactions)
          .where(eq(transactions.tradeId, trade.id))
          .orderBy(transactions.datetime);

        const tradeData: TradeData = {
          id: trade.id,
          instrumentTicker: trade.instrumentTicker,
          assetClass: trade.assetClass,
          exchange: trade.exchange,
          tradeDirection: trade.tradeDirection,
          status: trade.status,
          openDatetime: trade.openDatetime,
          closeDatetime: trade.closeDatetime,
          feesTotal: trade.feesTotal || "0",
          currentMarketPrice: trade.currentMarketPrice,
          rMultipleInitialRisk: trade.rMultipleInitialRisk,
        };

        const txData: TransactionData[] = tradeTransactions.map((tx) => ({
          id: tx.id,
          tradeId: tx.tradeId,
          action: tx.action,
          quantity: tx.quantity,
          price: tx.price,
          datetime: tx.datetime,
          fees: tx.fees || "0",
          notes: tx.notes,
        }));

        const pnl = calculateTradePnlFifo(tradeData, txData);

        return {
          ...trade,
          currentOpenQuantity: pnl.openQuantity,
          unrealizedPnl: pnl.unrealizedGrossPnl,
          realizedPnl: pnl.realizedNetPnl,
          averageOpenPrice: pnl.averageOpenPrice,
          outcome: pnl.outcome,
        };
      })
    );

    return tradesWithPnl;
  }),

  /**
   * Get a single trade by ID with all transactions
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number().or(z.string().uuid()) }))
    .query(async ({ ctx, input }) => {
      const tradeId = typeof input.id === "number" ? String(input.id) : input.id;

      const trade = await ctx.db
        .select()
        .from(trades)
        .where(eq(trades.id, tradeId))
        .limit(1);

      if (trade.length === 0) {
        return null;
      }

      const tradeData = trade[0]!;

      const tradeTransactions = await ctx.db
        .select()
        .from(transactions)
        .where(eq(transactions.tradeId, tradeId))
        .orderBy(transactions.datetime);

      const emotions = await ctx.db
        .select()
        .from(tradeEmotions)
        .where(eq(tradeEmotions.tradeId, tradeId));

      // Calculate P&L
      const txData: TransactionData[] = tradeTransactions.map((tx) => ({
        id: tx.id,
        tradeId: tx.tradeId,
        action: tx.action,
        quantity: tx.quantity,
        price: tx.price,
        datetime: tx.datetime,
        fees: tx.fees || "0",
        notes: tx.notes,
      }));

      const fullTradeData: TradeData = {
        id: tradeData.id,
        instrumentTicker: tradeData.instrumentTicker,
        assetClass: tradeData.assetClass,
        exchange: tradeData.exchange,
        tradeDirection: tradeData.tradeDirection,
        status: tradeData.status,
        openDatetime: tradeData.openDatetime,
        closeDatetime: tradeData.closeDatetime,
        feesTotal: tradeData.feesTotal || "0",
        currentMarketPrice: tradeData.currentMarketPrice,
        rMultipleInitialRisk: tradeData.rMultipleInitialRisk,
      };

      const pnl = calculateTradePnlFifo(fullTradeData, txData);

      return {
        ...tradeData,
        transactions: tradeTransactions,
        emotionIds: emotions.map((e) => e.emotionId),
        pnl,
      };
    }),

  /**
   * Update trade metadata (strategy, notes, etc.)
   */
  updateMetadata: protectedProcedure
    .input(updateTradeMetadataSchema)
    .mutation(async ({ ctx, input }) => {
      const { tradeId, emotionIds, ...metadata } = input;

      // Update trade metadata
      await ctx.db
        .update(trades)
        .set({
          ...metadata,
          updatedAt: new Date(),
        })
        .where(eq(trades.id, tradeId));

      // Update emotions if provided
      if (emotionIds !== undefined) {
        // Delete existing emotions
        await ctx.db
          .delete(tradeEmotions)
          .where(eq(tradeEmotions.tradeId, tradeId));

        // Insert new emotions
        if (emotionIds.length > 0) {
          await ctx.db.insert(tradeEmotions).values(
            emotionIds.map((emotionId) => ({
              tradeId,
              emotionId,
            }))
          );
        }
      }

      return { success: true };
    }),

  /**
   * Update market price for mark-to-market
   */
  updateMarkPrice: protectedProcedure
    .input(updateMarkPriceSchema)
    .mutation(async ({ ctx, input }) => {
      const { tradeId, marketPrice } = input;

      // Verify trade exists and is open
      const trade = await ctx.db
        .select()
        .from(trades)
        .where(and(eq(trades.id, tradeId), eq(trades.status, "open")))
        .limit(1);

      if (trade.length === 0) {
        throw new Error("Trade not found or is not open");
      }

      // Update market price
      await ctx.db
        .update(trades)
        .set({
          currentMarketPrice: marketPrice,
          updatedAt: new Date(),
        })
        .where(eq(trades.id, tradeId));

      // Recalculate P&L
      const tradeTransactions = await ctx.db
        .select()
        .from(transactions)
        .where(eq(transactions.tradeId, tradeId))
        .orderBy(transactions.datetime);

      const tradeData = trade[0]!;
      const txData: TransactionData[] = tradeTransactions.map((tx) => ({
        id: tx.id,
        tradeId: tx.tradeId,
        action: tx.action,
        quantity: tx.quantity,
        price: tx.price,
        datetime: tx.datetime,
        fees: tx.fees || "0",
        notes: tx.notes,
      }));

      const fullTradeData: TradeData = {
        id: tradeData.id,
        instrumentTicker: tradeData.instrumentTicker,
        assetClass: tradeData.assetClass,
        exchange: tradeData.exchange,
        tradeDirection: tradeData.tradeDirection,
        status: tradeData.status,
        openDatetime: tradeData.openDatetime,
        closeDatetime: tradeData.closeDatetime,
        feesTotal: tradeData.feesTotal || "0",
        currentMarketPrice: marketPrice,
        rMultipleInitialRisk: tradeData.rMultipleInitialRisk,
      };

      const pnl = calculateTradePnlFifo(fullTradeData, txData);

      return {
        success: true,
        unrealizedPnl: pnl.unrealizedGrossPnl,
        currentOpenQuantity: pnl.openQuantity,
        averageOpenPrice: pnl.averageOpenPrice,
      };
    }),

  /**
   * Delete a trade and all its transactions
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Transactions are deleted by CASCADE
      await ctx.db.delete(trades).where(eq(trades.id, input.id));
      return { success: true };
    }),
});
