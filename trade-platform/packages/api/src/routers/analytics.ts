import { createTRPCRouter, protectedProcedure } from "../trpc";
import { trades, transactions } from "@trade-platform/db/schema";
import { analyticsFiltersSchema } from "@trade-platform/core/validation";
import { calculateAnalytics } from "@trade-platform/core/analytics";
import type { TradeData, TransactionData } from "@trade-platform/core";

export const analyticsRouter = createTRPCRouter({
  /**
   * Get comprehensive analytics data
   */
  getAnalytics: protectedProcedure
    .input(analyticsFiltersSchema.optional())
    .query(async ({ ctx, input }) => {
      // Fetch all trades with transactions
      const allTrades = await ctx.db.select().from(trades);
      const allTransactions = await ctx.db.select().from(transactions);

      // Group transactions by trade
      const transactionsByTrade = new Map<string, TransactionData[]>();
      for (const tx of allTransactions) {
        const existing = transactionsByTrade.get(tx.tradeId) || [];
        existing.push({
          id: tx.id,
          tradeId: tx.tradeId,
          action: tx.action,
          quantity: tx.quantity,
          price: tx.price,
          datetime: tx.datetime,
          fees: tx.fees || "0",
          notes: tx.notes,
        });
        transactionsByTrade.set(tx.tradeId, existing);
      }

      // Build trade data with transactions
      const tradesWithTransactions: TradeData[] = allTrades.map((trade) => ({
        id: trade.id,
        instrumentTicker: trade.instrumentTicker,
        assetClass: trade.assetClass,
        exchange: trade.exchange,
        tradeDirection: trade.tradeDirection,
        status: trade.status,
        openDatetime: trade.openDatetime,
        closeDatetime: trade.closeDatetime,
        feesTotal: trade.feesTotal || "0",
        realizedPnl: trade.realizedPnl,
        unrealizedPnl: trade.unrealizedPnl,
        currentOpenQuantity: trade.currentOpenQuantity,
        averageOpenPrice: trade.averageOpenPrice,
        currentMarketPrice: trade.currentMarketPrice,
        rMultipleInitialRisk: trade.rMultipleInitialRisk,
        transactions: transactionsByTrade.get(trade.id) || [],
      }));

      // Calculate analytics
      const analytics = calculateAnalytics(tradesWithTransactions, input);

      return analytics;
    }),

  /**
   * Get summary metrics for dashboard
   */
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const allTrades = await ctx.db.select().from(trades);
    const allTransactions = await ctx.db.select().from(transactions);

    // Group transactions by trade
    const transactionsByTrade = new Map<string, TransactionData[]>();
    for (const tx of allTransactions) {
      const existing = transactionsByTrade.get(tx.tradeId) || [];
      existing.push({
        id: tx.id,
        tradeId: tx.tradeId,
        action: tx.action,
        quantity: tx.quantity,
        price: tx.price,
        datetime: tx.datetime,
        fees: tx.fees || "0",
        notes: tx.notes,
      });
      transactionsByTrade.set(tx.tradeId, existing);
    }

    // Build trade data
    const tradesWithTransactions: TradeData[] = allTrades.map((trade) => ({
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
      transactions: transactionsByTrade.get(trade.id) || [],
    }));

    const analytics = calculateAnalytics(tradesWithTransactions);

    return {
      totalRealizedPnl: analytics.totalRealizedNetPnl,
      totalUnrealizedPnl: analytics.totalUnrealizedPnl,
      winRate: analytics.winRateOverall,
      totalTrades: analytics.totalFullyClosedTrades,
      openTrades: allTrades.filter((t) => t.status === "open").length,
      winningTrades: analytics.numberOfWinningTrades,
      losingTrades: analytics.numberOfLosingTrades,
      maxDrawdown: analytics.maxDrawdownPercentage,
      equityCurve: analytics.equityCurve.slice(-30), // Last 30 points
    };
  }),
});
