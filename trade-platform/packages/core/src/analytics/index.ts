/**
 * Analytics calculations for trade performance analysis.
 *
 * Ported from the existing Electron app's calculateAnalyticsData function.
 */

import {
  toDecimal,
  add,
  subtract,
  divide,
  multiply,
  greaterThan,
  lessThan,
  isZero,
  toString,
  max,
  Decimal,
} from "../financial";
import { calculateTradePnlFifo } from "../pnl";
import type {
  TradeData,
  AnalyticsData,
  AnalyticsFilters,
  PnlCalculationResult,
  TimePerformanceData,
  GroupedPerformance,
  EquityCurvePoint,
  PnlPerTradePoint,
} from "../types";

interface TradeWithPnl extends TradeData {
  pnl: PnlCalculationResult;
}

/**
 * Calculates comprehensive analytics data from a set of trades.
 */
export function calculateAnalytics(
  trades: TradeData[],
  filters?: AnalyticsFilters
): AnalyticsData {
  // Apply filters
  let filteredTrades = [...trades];

  if (filters?.dateRange?.startDate) {
    filteredTrades = filteredTrades.filter(
      (t) => t.openDatetime && t.openDatetime >= filters.dateRange!.startDate!
    );
  }
  if (filters?.dateRange?.endDate) {
    filteredTrades = filteredTrades.filter(
      (t) => t.openDatetime && t.openDatetime <= filters.dateRange!.endDate!
    );
  }
  if (filters?.assetClasses?.length) {
    filteredTrades = filteredTrades.filter((t) =>
      filters.assetClasses!.includes(t.assetClass)
    );
  }
  if (filters?.exchanges?.length) {
    filteredTrades = filteredTrades.filter(
      (t) => t.exchange && filters.exchanges!.includes(t.exchange)
    );
  }

  // Calculate P&L for each trade
  const tradesWithPnl: TradeWithPnl[] = filteredTrades.map((trade) => ({
    ...trade,
    pnl: calculateTradePnlFifo(trade, trade.transactions || []),
  }));

  // Initialize analytics data
  let totalRealizedNetPnl = new Decimal(0);
  let totalRealizedGrossPnl = new Decimal(0);
  let totalFeesPaidOnClosedPortions = new Decimal(0);
  let totalUnrealizedPnl = new Decimal(0);
  let hasUnrealized = false;

  let sumWinningPnl = new Decimal(0);
  let sumLosingPnl = new Decimal(0);
  let numberOfWinningTrades = 0;
  let numberOfLosingTrades = 0;
  let numberOfBreakEvenTrades = 0;
  let totalFullyClosedTrades = 0;

  let largestWinPnl: Decimal | null = null;
  let largestLossPnl: Decimal | null = null;

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  let sumRMultiple = new Decimal(0);
  let rMultipleCount = 0;

  const pnlPerTradeSeries: PnlPerTradePoint[] = [];
  const equityCurve: EquityCurvePoint[] = [];

  const pnlByMonth = new Map<string, GroupedPerformance>();
  const pnlByDayOfWeek = new Map<string, GroupedPerformance>();
  const pnlByAssetClass = new Map<string, GroupedPerformance>();
  const pnlByExchange = new Map<string, GroupedPerformance>();
  const pnlByStrategy = new Map<string, GroupedPerformance>();

  // Process each trade
  for (const trade of tradesWithPnl) {
    const { pnl } = trade;
    const netPnl = toDecimal(pnl.realizedNetPnl);

    totalRealizedNetPnl = add(totalRealizedNetPnl, pnl.realizedNetPnl);
    totalRealizedGrossPnl = add(totalRealizedGrossPnl, pnl.realizedGrossPnl);
    totalFeesPaidOnClosedPortions = add(
      totalFeesPaidOnClosedPortions,
      pnl.feesAttributableToClosedPortion
    );

    if (pnl.unrealizedGrossPnl !== null) {
      totalUnrealizedPnl = add(totalUnrealizedPnl, pnl.unrealizedGrossPnl);
      hasUnrealized = true;
    }

    // Track outcomes for closed trades
    if (pnl.isFullyClosed) {
      totalFullyClosedTrades++;

      if (pnl.outcome === "win") {
        numberOfWinningTrades++;
        sumWinningPnl = add(sumWinningPnl, netPnl);
        if (largestWinPnl === null || greaterThan(netPnl, largestWinPnl)) {
          largestWinPnl = toDecimal(netPnl);
        }
        currentWinStreak++;
        currentLossStreak = 0;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else if (pnl.outcome === "loss") {
        numberOfLosingTrades++;
        sumLosingPnl = add(sumLosingPnl, netPnl);
        if (largestLossPnl === null || lessThan(netPnl, largestLossPnl)) {
          largestLossPnl = toDecimal(netPnl);
        }
        currentLossStreak++;
        currentWinStreak = 0;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      } else {
        numberOfBreakEvenTrades++;
        currentWinStreak = 0;
        currentLossStreak = 0;
      }

      // Track R-multiple
      if (pnl.rMultipleActual !== null) {
        sumRMultiple = add(sumRMultiple, pnl.rMultipleActual);
        rMultipleCount++;
      }

      // Add to P&L series
      if (trade.closeDatetime) {
        pnlPerTradeSeries.push({
          date: new Date(trade.closeDatetime).getTime(),
          pnl: pnl.realizedNetPnl,
          isFullyClosed: true,
        });
      }
    }

    // Group by time periods
    if (trade.openDatetime) {
      const openDate = new Date(trade.openDatetime);
      const monthKey = openDate.toLocaleString("default", { month: "long", year: "numeric" });
      const dayKey = openDate.toLocaleString("default", { weekday: "long" });

      updateGroupedData(pnlByMonth, monthKey, netPnl, pnl.outcome);
      updateGroupedData(pnlByDayOfWeek, dayKey, netPnl, pnl.outcome);
    }

    // Group by dimensions
    updateGroupedData(pnlByAssetClass, trade.assetClass, netPnl, pnl.outcome);
    if (trade.exchange) {
      updateGroupedData(pnlByExchange, trade.exchange, netPnl, pnl.outcome);
    }
  }

  // Calculate win rate
  const totalDecidedTrades = numberOfWinningTrades + numberOfLosingTrades;
  const winRateOverall =
    totalDecidedTrades > 0 ? numberOfWinningTrades / totalDecidedTrades : null;

  // Calculate averages
  const avgWinPnlOverall =
    numberOfWinningTrades > 0
      ? toString(divide(sumWinningPnl, numberOfWinningTrades))
      : null;
  const avgLossPnlOverall =
    numberOfLosingTrades > 0
      ? toString(divide(sumLosingPnl, numberOfLosingTrades))
      : null;
  const avgRMultiple =
    rMultipleCount > 0 ? toString(divide(sumRMultiple, rMultipleCount)) : null;

  // Calculate profit factor (gross wins / abs(gross losses))
  const absLossPnl = sumLosingPnl.abs();
  const profitFactor =
    !isZero(absLossPnl) && greaterThan(sumWinningPnl, 0)
      ? divide(sumWinningPnl, absLossPnl).toNumber()
      : null;

  // Calculate expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
  let expectancy: string | null = null;
  if (totalDecidedTrades > 0 && avgWinPnlOverall && avgLossPnlOverall) {
    const winPct = numberOfWinningTrades / totalDecidedTrades;
    const lossPct = numberOfLosingTrades / totalDecidedTrades;
    const avgWin = toDecimal(avgWinPnlOverall);
    const avgLoss = toDecimal(avgLossPnlOverall).abs();
    const exp = subtract(multiply(winPct, avgWin), multiply(lossPct, avgLoss));
    expectancy = toString(exp);
  }

  // Sort and calculate equity curve
  pnlPerTradeSeries.sort((a, b) => a.date - b.date);
  let cumulativePnl = new Decimal(0);
  for (const point of pnlPerTradeSeries) {
    cumulativePnl = add(cumulativePnl, point.pnl);
    equityCurve.push({
      date: point.date,
      equity: toString(cumulativePnl),
    });
  }

  // Calculate max drawdown
  const maxDrawdownPercentage = calculateMaxDrawdown(equityCurve);

  // Calculate win rates for grouped data
  const calculateWinRate = (data: GroupedPerformance) => {
    const decided = data.wins + data.losses;
    data.winRate = decided > 0 ? data.wins / decided : null;
  };

  const pnlByMonthArray = Array.from(pnlByMonth.values());
  const pnlByDayOfWeekArray = Array.from(pnlByDayOfWeek.values());
  const pnlByAssetClassArray = Array.from(pnlByAssetClass.values());
  const pnlByExchangeArray = Array.from(pnlByExchange.values());
  const pnlByStrategyArray = Array.from(pnlByStrategy.values());

  pnlByAssetClassArray.forEach(calculateWinRate);
  pnlByExchangeArray.forEach(calculateWinRate);
  pnlByStrategyArray.forEach(calculateWinRate);

  // Sort grouped data by P&L
  const sortByPnl = (a: GroupedPerformance, b: GroupedPerformance) =>
    toDecimal(b.totalNetPnl).minus(toDecimal(a.totalNetPnl)).toNumber();

  pnlByAssetClassArray.sort(sortByPnl);
  pnlByExchangeArray.sort(sortByPnl);
  pnlByStrategyArray.sort(sortByPnl);

  return {
    totalRealizedNetPnl: toString(totalRealizedNetPnl),
    totalRealizedGrossPnl: toString(totalRealizedGrossPnl),
    totalFeesPaidOnClosedPortions: toString(totalFeesPaidOnClosedPortions),
    totalUnrealizedPnl: hasUnrealized ? toString(totalUnrealizedPnl) : null,

    winRateOverall,
    averageWinPnl: avgWinPnlOverall,
    averageLossPnl: avgLossPnlOverall,
    largestWinPnl: largestWinPnl ? toString(largestWinPnl) : null,
    largestLossPnl: largestLossPnl ? toString(largestLossPnl) : null,
    longestWinStreak,
    longestLoseStreak: longestLossStreak,
    numberOfWinningTrades,
    numberOfLosingTrades,
    numberOfBreakEvenTrades,
    totalFullyClosedTrades,
    avgRMultiple,
    profitFactor,
    expectancy,

    equityCurve,
    pnlPerTradeSeries,

    pnlByMonth: pnlByMonthArray.map(toTimePerformance),
    pnlByDayOfWeek: pnlByDayOfWeekArray.map(toTimePerformance),

    pnlByAssetClass: pnlByAssetClassArray,
    pnlByExchange: pnlByExchangeArray,
    pnlByStrategy: pnlByStrategyArray,
    pnlByEmotion: [], // To be implemented with emotion data

    maxDrawdownPercentage,
  };
}

function updateGroupedData(
  map: Map<string, GroupedPerformance>,
  key: string,
  pnl: Decimal,
  outcome: "win" | "loss" | "break_even" | null
) {
  let data = map.get(key);
  if (!data) {
    data = {
      name: key,
      totalNetPnl: "0",
      winRate: null,
      tradeCount: 0,
      wins: 0,
      losses: 0,
      breakEvens: 0,
    };
    map.set(key, data);
  }

  data.totalNetPnl = toString(add(data.totalNetPnl, pnl));
  data.tradeCount++;

  if (outcome === "win") data.wins++;
  else if (outcome === "loss") data.losses++;
  else if (outcome === "break_even") data.breakEvens++;
}

function toTimePerformance(data: GroupedPerformance): TimePerformanceData {
  const decided = data.wins + data.losses;
  return {
    period: data.name,
    totalNetPnl: data.totalNetPnl,
    tradeCount: data.tradeCount,
    winRate: decided > 0 ? data.wins / decided : null,
    wins: data.wins,
    losses: data.losses,
    breakEvens: data.breakEvens,
  };
}

function calculateMaxDrawdown(equityCurve: EquityCurvePoint[]): string | null {
  if (equityCurve.length === 0) return null;

  let peak = new Decimal("-Infinity");
  let maxDrawdown = new Decimal(0);

  for (const point of equityCurve) {
    const equity = toDecimal(point.equity);
    if (equity.greaterThan(peak)) {
      peak = equity;
    }
    if (peak.greaterThan(0)) {
      const drawdown = divide(subtract(equity, peak), peak);
      if (drawdown.lessThan(maxDrawdown)) {
        maxDrawdown = drawdown;
      }
    }
  }

  // Return as positive percentage
  return toString(multiply(maxDrawdown.abs(), 100));
}
