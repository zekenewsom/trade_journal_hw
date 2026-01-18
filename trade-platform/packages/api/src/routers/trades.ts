import { z } from "zod";
import { eq, desc, and, inArray } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { trades, transactions, tradeEmotions, emotions, users, organizations, orgMembers } from "@trade-platform/db/schema";
import {
  updateTradeMetadataSchema,
  updateMarkPriceSchema,
} from "@trade-platform/core/validation";
import { calculateTradePnlFifo, shouldCloseTrade } from "@trade-platform/core/pnl";
import { toDecimal, toString, add, subtract, multiply, divide, greaterThan } from "@trade-platform/core/financial";
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

        // Auto-fix trade status if needed
        const shouldBeClosed = txData.length > 0 && shouldCloseTrade(txData, trade.tradeDirection);
        const currentStatus = trade.status;
        const correctStatus = shouldBeClosed ? "closed" : "open";

        if (currentStatus !== correctStatus && txData.length > 0) {
          // Fix the status in the background
          const lastTxDatetime = txData[txData.length - 1]?.datetime;
          await ctx.db
            .update(trades)
            .set({
              status: correctStatus,
              closeDatetime: shouldBeClosed ? lastTxDatetime : null,
              updatedAt: new Date(),
            })
            .where(eq(trades.id, trade.id));
        }

        // Calculate average buy and sell prices
        let totalBuyQty = toDecimal(0);
        let totalBuyValue = toDecimal(0);
        let totalSellQty = toDecimal(0);
        let totalSellValue = toDecimal(0);

        for (const tx of txData) {
          const qty = toDecimal(tx.quantity);
          const price = toDecimal(tx.price);
          const value = qty.times(price);

          if (tx.action === "buy") {
            totalBuyQty = add(totalBuyQty, qty);
            totalBuyValue = add(totalBuyValue, value);
          } else {
            totalSellQty = add(totalSellQty, qty);
            totalSellValue = add(totalSellValue, value);
          }
        }

        const avgBuyPrice = totalBuyQty.greaterThan(0)
          ? toString(totalBuyValue.dividedBy(totalBuyQty))
          : null;
        const avgSellPrice = totalSellQty.greaterThan(0)
          ? toString(totalSellValue.dividedBy(totalSellQty))
          : null;

        return {
          ...trade,
          status: correctStatus, // Use corrected status
          currentOpenQuantity: pnl.openQuantity,
          unrealizedPnl: pnl.unrealizedGrossPnl,
          realizedPnl: pnl.realizedNetPnl,
          averageOpenPrice: pnl.averageOpenPrice,
          avgBuyPrice,
          avgSellPrice,
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

      const tradeEmotionRecords = await ctx.db
        .select()
        .from(tradeEmotions)
        .where(eq(tradeEmotions.tradeId, tradeId));

      // Fetch emotion names if there are any emotion IDs
      const emotionIds = tradeEmotionRecords.map((e) => e.emotionId);
      let emotionNames: { id: string; name: string }[] = [];
      if (emotionIds.length > 0) {
        emotionNames = await ctx.db
          .select({ id: emotions.id, name: emotions.name })
          .from(emotions)
          .where(inArray(emotions.id, emotionIds));
      }

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
        emotionIds,
        emotions: emotionNames,
        pnl,
      };
    }),

  /**
   * Update trade metadata (strategy, notes, etc.)
   */
  updateMetadata: protectedProcedure
    .input(updateTradeMetadataSchema)
    .mutation(async ({ ctx, input }) => {
      const { tradeId, emotionIds, decisionPrice, ...metadata } = input;

      // Fetch the trade and transactions to calculate derived metrics
      const trade = await ctx.db
        .select()
        .from(trades)
        .where(eq(trades.id, tradeId))
        .limit(1);

      if (trade.length === 0) {
        throw new Error("Trade not found");
      }

      const tradeData = trade[0]!;
      const tradeTransactions = await ctx.db
        .select()
        .from(transactions)
        .where(eq(transactions.tradeId, tradeId))
        .orderBy(transactions.datetime);

      // Calculate implementation shortfall if decision price is provided
      let implementationShortfall: string | null = null;
      if (decisionPrice) {
        // Get the first transaction price (execution price)
        if (tradeTransactions.length > 0) {
          const firstTx = tradeTransactions[0]!;
          const decPrice = toDecimal(decisionPrice);
          const execPrice = toDecimal(firstTx.price);
          // Implementation shortfall = (exec price - decision price) / decision price
          // For longs: positive means you paid more than intended
          // For shorts: negative means you got less than intended
          if (tradeData.tradeDirection === "long") {
            implementationShortfall = toString(
              divide(subtract(execPrice, decPrice), decPrice)
            );
          } else {
            // For shorts, we want to sell high, so shortfall is (decision - exec) / decision
            implementationShortfall = toString(
              divide(subtract(decPrice, execPrice), decPrice)
            );
          }
        }
      }

      // Calculate maxCapitalUsed and returnOnAllocatedCapital for closed trades
      let maxCapitalUsed: string | null = null;
      let returnOnAllocatedCapital: string | null = null;

      if (tradeTransactions.length > 0) {
        // Calculate max capital used (peak position value)
        let runningPosition = toDecimal(0);
        let maxPositionValue = toDecimal(0);

        for (const tx of tradeTransactions) {
          const qty = toDecimal(tx.quantity);
          const price = toDecimal(tx.price);

          if (
            (tradeData.tradeDirection === "long" && tx.action === "buy") ||
            (tradeData.tradeDirection === "short" && tx.action === "sell")
          ) {
            runningPosition = add(runningPosition, qty);
          } else {
            runningPosition = subtract(runningPosition, qty);
          }

          // Track peak position value
          const positionValue = multiply(runningPosition.abs(), price);
          if (greaterThan(positionValue, maxPositionValue)) {
            maxPositionValue = positionValue;
          }
        }

        maxCapitalUsed = toString(maxPositionValue);

        // Calculate return on allocated capital if trade has realized P&L
        if (tradeData.realizedPnl && greaterThan(maxPositionValue, 0)) {
          const realizedPnl = toDecimal(tradeData.realizedPnl);
          returnOnAllocatedCapital = toString(divide(realizedPnl, maxPositionValue));
        }
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        ...metadata,
        updatedAt: new Date(),
      };

      if (decisionPrice !== undefined) {
        updateData.decisionPrice = decisionPrice;
      }
      if (implementationShortfall !== null) {
        updateData.implementationShortfall = implementationShortfall;
      }
      if (maxCapitalUsed !== null) {
        updateData.maxCapitalUsed = maxCapitalUsed;
      }
      if (returnOnAllocatedCapital !== null) {
        updateData.returnOnAllocatedCapital = returnOnAllocatedCapital;
      }

      // Update trade metadata
      await ctx.db
        .update(trades)
        .set(updateData)
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

  /**
   * Recalculate statuses for all trades in the user's organization.
   * This fixes any trades that should be closed but are marked as open.
   */
  recalculateStatuses: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = await getUserOrgId(ctx.db, ctx.userId!);

    if (!orgId) {
      return { updated: 0, errors: [] };
    }

    // Get all trades for this org
    const allTrades = await ctx.db
      .select()
      .from(trades)
      .where(eq(trades.orgId, orgId));

    let updated = 0;
    const errors: Array<{ tradeId: string; error: string }> = [];

    for (const trade of allTrades) {
      try {
        // Get all transactions for this trade
        const tradeTransactions = await ctx.db
          .select()
          .from(transactions)
          .where(eq(transactions.tradeId, trade.id))
          .orderBy(transactions.datetime);

        if (tradeTransactions.length === 0) continue;

        // Convert to TransactionData format
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

        // Calculate total fees
        const totalFees = txData.reduce(
          (sum, tx) => add(sum, tx.fees),
          toDecimal(0)
        );

        // Check if trade should be closed
        const isClosed = shouldCloseTrade(txData, trade.tradeDirection);
        const currentStatus = trade.status;
        const newStatus = isClosed ? "closed" : "open";

        // Get first and last transaction dates
        const firstTxDatetime = txData[0]?.datetime;
        const lastTxDatetime = txData[txData.length - 1]?.datetime;

        // Only update if status has changed
        if (currentStatus !== newStatus) {
          await ctx.db
            .update(trades)
            .set({
              status: newStatus,
              openDatetime: firstTxDatetime,
              closeDatetime: isClosed ? lastTxDatetime : null,
              feesTotal: toString(totalFees),
              updatedAt: new Date(),
            })
            .where(eq(trades.id, trade.id));

          updated++;
        }
      } catch (error) {
        errors.push({
          tradeId: trade.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      updated,
      total: allTrades.length,
      errors,
    };
  }),
});
