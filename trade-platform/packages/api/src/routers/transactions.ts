import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  trades,
  transactions,
  transactionEmotions,
} from "@trade-platform/db/schema";
import {
  logTransactionSchema,
  updateTransactionSchema,
} from "@trade-platform/core/validation";
import {
  calculateTradePnlFifo,
  determineTradeDirection,
  shouldCloseTrade,
} from "@trade-platform/core/pnl";
import { add, toDecimal, toString } from "@trade-platform/core/financial";
import type { TransactionData, TradeData } from "@trade-platform/core";

export const transactionsRouter = createTRPCRouter({
  /**
   * Log a new transaction - creates trade if needed, or adds to existing
   */
  log: protectedProcedure
    .input(logTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      const {
        instrumentTicker,
        assetClass,
        exchange,
        action,
        datetime,
        quantity,
        price,
        fees,
        notes,
        emotionIds,
        ...metadata
      } = input;

      // Check for existing open trade with same ticker/asset/exchange
      const existingTrades = await ctx.db
        .select()
        .from(trades)
        .where(
          and(
            eq(trades.instrumentTicker, instrumentTicker),
            eq(trades.assetClass, assetClass),
            eq(trades.exchange, exchange || ""),
            eq(trades.status, "open")
          )
        )
        .limit(1);

      let tradeId: string;
      let tradeDirection: "long" | "short";

      if (existingTrades.length > 0) {
        // Add to existing trade
        const existingTrade = existingTrades[0]!;
        tradeId = existingTrade.id;
        tradeDirection = existingTrade.tradeDirection;
      } else {
        // Create new trade
        tradeDirection = determineTradeDirection(action);

        // For org_id, we'd need to look up the user's org
        // For now, we'll use a placeholder UUID
        const placeholderOrgId = "00000000-0000-0000-0000-000000000000";

        const newTrade = await ctx.db
          .insert(trades)
          .values({
            orgId: placeholderOrgId,
            instrumentTicker,
            assetClass,
            exchange,
            tradeDirection,
            status: "open",
            openDatetime: datetime,
            feesTotal: "0",
            ...metadata,
          })
          .returning({ id: trades.id });

        tradeId = newTrade[0]!.id;
      }

      // Insert the transaction
      const newTransaction = await ctx.db
        .insert(transactions)
        .values({
          tradeId,
          action,
          quantity,
          price,
          datetime,
          fees: fees || "0",
          notes,
          ...metadata,
        })
        .returning({ id: transactions.id });

      const transactionId = newTransaction[0]!.id;

      // Insert emotions if provided
      if (emotionIds && emotionIds.length > 0) {
        await ctx.db.insert(transactionEmotions).values(
          emotionIds.map((emotionId) => ({
            transactionId,
            emotionId,
          }))
        );
      }

      // Recalculate trade state
      const allTransactions = await ctx.db
        .select()
        .from(transactions)
        .where(eq(transactions.tradeId, tradeId))
        .orderBy(transactions.datetime);

      const txData: TransactionData[] = allTransactions.map((tx) => ({
        id: tx.id,
        tradeId: tx.tradeId,
        action: tx.action,
        quantity: tx.quantity,
        price: tx.price,
        datetime: tx.datetime,
        fees: tx.fees || "0",
        notes: tx.notes,
      }));

      // Update trade status and fees
      const totalFees = txData.reduce(
        (sum, tx) => add(sum, tx.fees),
        toDecimal(0)
      );

      const isClosed = shouldCloseTrade(txData, tradeDirection);
      const lastTxDatetime = allTransactions[allTransactions.length - 1]?.datetime;

      await ctx.db
        .update(trades)
        .set({
          status: isClosed ? "closed" : "open",
          closeDatetime: isClosed ? lastTxDatetime : null,
          feesTotal: toString(totalFees),
          updatedAt: new Date(),
        })
        .where(eq(trades.id, tradeId));

      // Calculate P&L for response
      const updatedTrade = await ctx.db
        .select()
        .from(trades)
        .where(eq(trades.id, tradeId))
        .limit(1);

      const tradeData: TradeData = {
        id: tradeId,
        instrumentTicker,
        assetClass,
        exchange,
        tradeDirection,
        status: isClosed ? "closed" : "open",
        openDatetime: updatedTrade[0]?.openDatetime || datetime,
        closeDatetime: isClosed ? lastTxDatetime : null,
        feesTotal: toString(totalFees),
        currentMarketPrice: null,
        rMultipleInitialRisk: null,
      };

      const pnl = calculateTradePnlFifo(tradeData, txData);

      return {
        success: true,
        tradeId,
        transactionId,
        unrealizedPnl: pnl.unrealizedGrossPnl,
        currentOpenQuantity: pnl.openQuantity,
        averageOpenPrice: pnl.averageOpenPrice,
      };
    }),

  /**
   * Update an existing transaction
   */
  update: protectedProcedure
    .input(updateTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      const { transactionId, emotionIds, ...updateData } = input;

      // Get the transaction to find its trade
      const existingTx = await ctx.db
        .select()
        .from(transactions)
        .where(eq(transactions.id, transactionId))
        .limit(1);

      if (existingTx.length === 0) {
        throw new Error("Transaction not found");
      }

      const tradeId = existingTx[0]!.tradeId;

      // Update transaction
      await ctx.db
        .update(transactions)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transactionId));

      // Update emotions if provided
      if (emotionIds !== undefined) {
        await ctx.db
          .delete(transactionEmotions)
          .where(eq(transactionEmotions.transactionId, transactionId));

        if (emotionIds.length > 0) {
          await ctx.db.insert(transactionEmotions).values(
            emotionIds.map((emotionId) => ({
              transactionId,
              emotionId,
            }))
          );
        }
      }

      // Recalculate trade state
      const trade = await ctx.db
        .select()
        .from(trades)
        .where(eq(trades.id, tradeId))
        .limit(1);

      if (trade.length > 0) {
        const allTransactions = await ctx.db
          .select()
          .from(transactions)
          .where(eq(transactions.tradeId, tradeId))
          .orderBy(transactions.datetime);

        const txData: TransactionData[] = allTransactions.map((tx) => ({
          id: tx.id,
          tradeId: tx.tradeId,
          action: tx.action,
          quantity: tx.quantity,
          price: tx.price,
          datetime: tx.datetime,
          fees: tx.fees || "0",
          notes: tx.notes,
        }));

        const totalFees = txData.reduce(
          (sum, tx) => add(sum, tx.fees),
          toDecimal(0)
        );

        const isClosed = shouldCloseTrade(txData, trade[0]!.tradeDirection);
        const lastTxDatetime = allTransactions[allTransactions.length - 1]?.datetime;

        await ctx.db
          .update(trades)
          .set({
            status: isClosed ? "closed" : "open",
            closeDatetime: isClosed ? lastTxDatetime : null,
            feesTotal: toString(totalFees),
            updatedAt: new Date(),
          })
          .where(eq(trades.id, tradeId));
      }

      return { success: true };
    }),

  /**
   * Delete a transaction
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get the transaction to find its trade
      const existingTx = await ctx.db
        .select()
        .from(transactions)
        .where(eq(transactions.id, input.id))
        .limit(1);

      if (existingTx.length === 0) {
        throw new Error("Transaction not found");
      }

      const tradeId = existingTx[0]!.tradeId;

      // Delete the transaction
      await ctx.db.delete(transactions).where(eq(transactions.id, input.id));

      // Check if trade has any remaining transactions
      const remainingTx = await ctx.db
        .select()
        .from(transactions)
        .where(eq(transactions.tradeId, tradeId))
        .limit(1);

      if (remainingTx.length === 0) {
        // Delete the trade if no transactions remain
        await ctx.db.delete(trades).where(eq(trades.id, tradeId));
      } else {
        // Recalculate trade state
        const trade = await ctx.db
          .select()
          .from(trades)
          .where(eq(trades.id, tradeId))
          .limit(1);

        if (trade.length > 0) {
          const allTransactions = await ctx.db
            .select()
            .from(transactions)
            .where(eq(transactions.tradeId, tradeId))
            .orderBy(transactions.datetime);

          const txData: TransactionData[] = allTransactions.map((tx) => ({
            id: tx.id,
            tradeId: tx.tradeId,
            action: tx.action,
            quantity: tx.quantity,
            price: tx.price,
            datetime: tx.datetime,
            fees: tx.fees || "0",
            notes: tx.notes,
          }));

          const totalFees = txData.reduce(
            (sum, tx) => add(sum, tx.fees),
            toDecimal(0)
          );

          const isClosed = shouldCloseTrade(txData, trade[0]!.tradeDirection);
          const lastTxDatetime = allTransactions[allTransactions.length - 1]?.datetime;
          const firstTxDatetime = allTransactions[0]?.datetime;

          await ctx.db
            .update(trades)
            .set({
              status: isClosed ? "closed" : "open",
              openDatetime: firstTxDatetime,
              closeDatetime: isClosed ? lastTxDatetime : null,
              feesTotal: toString(totalFees),
              updatedAt: new Date(),
            })
            .where(eq(trades.id, tradeId));
        }
      }

      return { success: true };
    }),
});
