import { eq, inArray } from "drizzle-orm";
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

      // Get trade IDs for filtering transactions
      const tradeIds = allTrades.map((t) => t.id);

      // Fetch only transactions that belong to this org's trades
      const allTransactions = tradeIds.length > 0
        ? await ctx.db.select().from(transactions).where(inArray(transactions.tradeId, tradeIds))
        : [];

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
        // Core P&L Metrics
        totalRealizedNetPnl: "0",
        totalRealizedGrossPnl: "0",
        totalFeesPaidOnClosedPortions: "0",
        totalUnrealizedPnl: "0",
        totalFees: "0",

        // Win/Loss Metrics
        winRateOverall: null,
        totalTrades: 0,
        closedTrades: 0,
        openTrades: 0,
        numberOfWinningTrades: 0,
        numberOfLosingTrades: 0,
        numberOfBreakEvenTrades: 0,

        // Performance Metrics
        averageWinPnl: "0",
        averageLossPnl: "0",
        largestWinPnl: "0",
        largestLossPnl: "0",
        smallestWinPnl: "0",
        smallestLossPnl: "0",
        medianPnl: "0",
        standardDeviationPnl: "0",

        // Risk-Adjusted Returns (Institutional)
        sharpeRatio: null,
        sortinoRatio: null,
        calmarRatio: null,
        recoveryFactor: null,
        returnOnMaxDrawdown: null,

        // Performance Ratios
        profitFactor: null,
        expectancy: "0",
        payoffRatio: null,
        kellyCriterion: null,
        avgRMultiple: null,

        // Volatility Metrics
        returnVolatility: null,
        downsideDeviation: null,
        ulcerIndex: null,

        // Statistical Metrics
        skewness: null,
        kurtosis: null,

        // Streak Metrics
        longestWinStreak: 0,
        longestLoseStreak: 0,
        averageWinStreak: null,
        averageLoseStreak: null,
        currentStreak: 0,
        currentStreakType: "none" as const,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,

        // Trade Duration Metrics
        averageTradeDuration: null,
        averageWinningTradeDuration: null,
        averageLosingTradeDuration: null,
        shortestTradeDuration: null,
        longestTradeDuration: null,

        // Drawdown Metrics
        maxDrawdownPercentage: "0",
        maxDrawdownDollar: "0",
        averageDrawdown: "0",
        maxDrawdownDuration: null,
        currentDrawdown: "0",
        drawdownPeriods: [],

        // Time-Based Performance
        bestTradingDay: null,
        worstTradingDay: null,
        bestTradingMonth: null,
        worstTradingMonth: null,

        // Charts
        equityCurve: [],
        dailyReturns: [],
        pnlPerTradeSeries: [],

        // Grouped Performance
        pnlByAssetClass: [],
        pnlByExchange: [],
        pnlByMonth: [],
        pnlByDayOfWeek: [],
        pnlByHourOfDay: [],
        pnlByWeekOfYear: [],
        pnlByTradeDirection: [],

        // Recent Activity
        recentTrades: [],
      };
    }

    // Fetch trades for this org only
    const allTrades = await ctx.db.select().from(trades).where(eq(trades.orgId, orgId));

    // Get trade IDs for filtering transactions
    const tradeIds = allTrades.map((t) => t.id);

    // Fetch only transactions that belong to this org's trades
    const allTransactions = tradeIds.length > 0
      ? await ctx.db.select().from(transactions).where(inArray(transactions.tradeId, tradeIds))
      : [];

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
      // Core P&L Metrics
      totalRealizedNetPnl: analytics.totalRealizedNetPnl,
      totalRealizedGrossPnl: analytics.totalRealizedGrossPnl,
      totalFeesPaidOnClosedPortions: analytics.totalFeesPaidOnClosedPortions,
      totalUnrealizedPnl: analytics.totalUnrealizedPnl || "0",
      totalFees: totalFees.toFixed(2),

      // Win/Loss Metrics
      winRateOverall: analytics.winRateOverall,
      totalTrades: allTrades.length,
      closedTrades: analytics.totalFullyClosedTrades,
      openTrades: allTrades.filter((t) => t.status === "open").length,
      numberOfWinningTrades: analytics.numberOfWinningTrades,
      numberOfLosingTrades: analytics.numberOfLosingTrades,
      numberOfBreakEvenTrades: analytics.numberOfBreakEvenTrades,

      // Performance Metrics
      averageWinPnl: analytics.averageWinPnl || "0",
      averageLossPnl: analytics.averageLossPnl || "0",
      largestWinPnl: analytics.largestWinPnl || "0",
      largestLossPnl: analytics.largestLossPnl || "0",
      smallestWinPnl: analytics.smallestWinPnl || "0",
      smallestLossPnl: analytics.smallestLossPnl || "0",
      medianPnl: analytics.medianPnl || "0",
      standardDeviationPnl: analytics.standardDeviationPnl || "0",

      // Risk-Adjusted Returns (Institutional)
      sharpeRatio: analytics.sharpeRatio,
      sortinoRatio: analytics.sortinoRatio,
      calmarRatio: analytics.calmarRatio,
      recoveryFactor: analytics.recoveryFactor,
      returnOnMaxDrawdown: analytics.returnOnMaxDrawdown,

      // Performance Ratios
      profitFactor: analytics.profitFactor,
      expectancy: analytics.expectancy || "0",
      payoffRatio: analytics.payoffRatio,
      kellyCriterion: analytics.kellyCriterion,
      avgRMultiple: analytics.avgRMultiple,

      // Volatility Metrics
      returnVolatility: analytics.returnVolatility,
      downsideDeviation: analytics.downsideDeviation,
      ulcerIndex: analytics.ulcerIndex,

      // Statistical Metrics
      skewness: analytics.skewness,
      kurtosis: analytics.kurtosis,

      // Streak Metrics
      longestWinStreak: analytics.longestWinStreak,
      longestLoseStreak: analytics.longestLoseStreak,
      averageWinStreak: analytics.averageWinStreak,
      averageLoseStreak: analytics.averageLoseStreak,
      currentStreak: analytics.currentStreak,
      currentStreakType: analytics.currentStreakType,
      maxConsecutiveWins: analytics.maxConsecutiveWins,
      maxConsecutiveLosses: analytics.maxConsecutiveLosses,

      // Trade Duration Metrics
      averageTradeDuration: analytics.averageTradeDuration,
      averageWinningTradeDuration: analytics.averageWinningTradeDuration,
      averageLosingTradeDuration: analytics.averageLosingTradeDuration,
      shortestTradeDuration: analytics.shortestTradeDuration,
      longestTradeDuration: analytics.longestTradeDuration,

      // Drawdown Metrics
      maxDrawdownPercentage: analytics.maxDrawdownPercentage || "0",
      maxDrawdownDollar: analytics.maxDrawdownDollar || "0",
      averageDrawdown: analytics.averageDrawdown || "0",
      maxDrawdownDuration: analytics.maxDrawdownDuration,
      currentDrawdown: analytics.currentDrawdown || "0",
      drawdownPeriods: analytics.drawdownPeriods,

      // Time-Based Performance
      bestTradingDay: analytics.bestTradingDay,
      worstTradingDay: analytics.worstTradingDay,
      bestTradingMonth: analytics.bestTradingMonth,
      worstTradingMonth: analytics.worstTradingMonth,

      // Charts
      equityCurve: analytics.equityCurve,
      dailyReturns: analytics.dailyReturns,
      pnlPerTradeSeries: analytics.pnlPerTradeSeries,

      // Grouped Performance
      pnlByAssetClass: analytics.pnlByAssetClass,
      pnlByExchange: analytics.pnlByExchange,
      pnlByMonth: analytics.pnlByMonth,
      pnlByDayOfWeek: analytics.pnlByDayOfWeek,
      pnlByHourOfDay: analytics.pnlByHourOfDay,
      pnlByWeekOfYear: analytics.pnlByWeekOfYear,
      pnlByTradeDirection: analytics.pnlByTradeDirection,

      // Recent Activity
      recentTrades: recentClosedTrades,
    };
  }),
});
