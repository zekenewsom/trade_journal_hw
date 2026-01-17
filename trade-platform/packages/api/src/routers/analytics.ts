import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { trades, transactions, users, organizations, orgMembers } from "@trade-platform/db/schema";
import { analyticsFiltersSchema } from "@trade-platform/core/validation";
import { calculateAnalytics } from "@trade-platform/core/analytics";
import type { TradeData, TransactionData } from "@trade-platform/core";

/**
 * Helper to get user's organization ID
 */
async function getUserOrgId(db: any, externalUserId: string): Promise<string | null> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.externalId, externalUserId))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  const userId = user[0].id;

  const membership = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1);

  if (membership.length > 0) {
    return membership[0].orgId;
  }

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

export const analyticsRouter = createTRPCRouter({
  /**
   * Get comprehensive analytics data
   */
  getAnalytics: protectedProcedure
    .input(analyticsFiltersSchema.optional())
    .query(async ({ ctx, input }) => {
      // Get user's organization
      const orgId = await getUserOrgId(ctx.db, ctx.userId!);

      if (!orgId) {
        return null;
      }

      // Fetch trades for this org only
      const allTrades = await ctx.db.select().from(trades).where(eq(trades.orgId, orgId));
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
   * Get comprehensive summary metrics for dashboard and analytics pages
   */
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    // Get user's organization
    const orgId = await getUserOrgId(ctx.db, ctx.userId!);

    if (!orgId) {
      return {
        totalRealizedPnl: "0",
        totalUnrealizedPnl: "0",
        totalFees: "0",
        winRate: 0,
        totalTrades: 0,
        closedTrades: 0,
        openTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        maxDrawdown: 0,
        avgWin: "0",
        avgLoss: "0",
        largestWin: "0",
        largestLoss: "0",
        profitFactor: 0,
        expectancy: "0",
        longestWinStreak: 0,
        longestLoseStreak: 0,
        equityCurve: [],
        pnlByAssetClass: [],
        pnlByExchange: [],
        pnlByMonth: [],
        pnlByDayOfWeek: [],
        recentTrades: [],
      };
    }

    // Fetch trades for this org only
    const allTrades = await ctx.db.select().from(trades).where(eq(trades.orgId, orgId));
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

    // Build trade data - only include trades that belong to this org
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

    // Calculate total fees
    const totalFees = allTrades.reduce((sum, t) => {
      return sum + parseFloat(t.feesTotal || "0");
    }, 0);

    // Get recent closed trades for display
    const recentClosedTrades = allTrades
      .filter((t) => t.status === "closed" && t.closeDatetime)
      .sort((a, b) => new Date(b.closeDatetime!).getTime() - new Date(a.closeDatetime!).getTime())
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        ticker: t.instrumentTicker,
        assetClass: t.assetClass,
        direction: t.tradeDirection,
        closeDatetime: t.closeDatetime?.toISOString(),
      }));

    return {
      // P&L Metrics
      totalRealizedPnl: analytics.totalRealizedNetPnl,
      totalUnrealizedPnl: analytics.totalUnrealizedPnl || "0",
      totalFees: totalFees.toFixed(2),

      // Win/Loss Metrics
      winRate: analytics.winRateOverall || 0,
      totalTrades: allTrades.length,
      closedTrades: analytics.totalFullyClosedTrades,
      openTrades: allTrades.filter((t) => t.status === "open").length,
      winningTrades: analytics.numberOfWinningTrades,
      losingTrades: analytics.numberOfLosingTrades,
      breakEvenTrades: analytics.numberOfBreakEvenTrades,

      // Performance Metrics
      avgWin: analytics.averageWinPnl || "0",
      avgLoss: analytics.averageLossPnl || "0",
      largestWin: analytics.largestWinPnl || "0",
      largestLoss: analytics.largestLossPnl || "0",
      profitFactor: analytics.profitFactor || 0,
      expectancy: analytics.expectancy || "0",

      // Risk Metrics
      maxDrawdown: analytics.maxDrawdownPercentage || "0",
      longestWinStreak: analytics.longestWinStreak,
      longestLoseStreak: analytics.longestLoseStreak,

      // Charts
      equityCurve: analytics.equityCurve,
      pnlByAssetClass: analytics.pnlByAssetClass,
      pnlByExchange: analytics.pnlByExchange,
      pnlByMonth: analytics.pnlByMonth,
      pnlByDayOfWeek: analytics.pnlByDayOfWeek,

      // Recent Activity
      recentTrades: recentClosedTrades,
    };
  }),
});
