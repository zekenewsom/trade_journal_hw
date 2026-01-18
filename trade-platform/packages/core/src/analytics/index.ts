/**
 * Analytics calculations for trade performance analysis.
 *
 * Comprehensive institutional-grade analytics including:
 * - Risk-adjusted returns (Sharpe, Sortino, Calmar)
 * - Drawdown analysis
 * - Trade duration metrics
 * - Statistical analysis (skewness, kurtosis)
 * - Kelly criterion
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
  DailyReturnPoint,
  DrawdownPeriod,
} from "../types";

interface TradeWithPnl extends TradeData {
  pnl: PnlCalculationResult;
}

// Risk-free rate assumption (annualized) - typically use T-bill rate
const RISK_FREE_RATE = 0.05; // 5% annual risk-free rate
const TRADING_DAYS_PER_YEAR = 252;

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
  let totalFees = new Decimal(0);
  let hasUnrealized = false;

  let sumWinningPnl = new Decimal(0);
  let sumLosingPnl = new Decimal(0);
  let numberOfWinningTrades = 0;
  let numberOfLosingTrades = 0;
  let numberOfBreakEvenTrades = 0;
  let totalFullyClosedTrades = 0;
  let openTrades = 0;

  let largestWinPnl: Decimal | null = null;
  let largestLossPnl: Decimal | null = null;
  let smallestWinPnl: Decimal | null = null;
  let smallestLossPnl: Decimal | null = null;

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];

  let sumRMultiple = new Decimal(0);
  let rMultipleCount = 0;

  // Duration tracking
  let totalDuration = 0;
  let totalWinDuration = 0;
  let totalLossDuration = 0;
  let winDurationCount = 0;
  let lossDurationCount = 0;
  let shortestDuration: number | null = null;
  let longestDuration: number | null = null;

  const pnlPerTradeSeries: PnlPerTradePoint[] = [];
  const closedTradePnls: Decimal[] = []; // For statistical analysis

  const pnlByMonth = new Map<string, GroupedPerformance>();
  const pnlByDayOfWeek = new Map<string, GroupedPerformance>();
  const pnlByHourOfDay = new Map<string, GroupedPerformance>();
  const pnlByWeekOfYear = new Map<string, GroupedPerformance>();
  const pnlByAssetClass = new Map<string, GroupedPerformance>();
  const pnlByExchange = new Map<string, GroupedPerformance>();
  const pnlByStrategy = new Map<string, GroupedPerformance>();
  const pnlByTradeDirection = new Map<string, GroupedPerformance>();
  const dailyPnlMap = new Map<string, { pnl: Decimal; tradeCount: number }>();

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
    totalFees = add(totalFees, trade.feesTotal || "0");

    if (pnl.unrealizedGrossPnl !== null) {
      totalUnrealizedPnl = add(totalUnrealizedPnl, pnl.unrealizedGrossPnl);
      hasUnrealized = true;
    }

    // Track open vs closed trades
    if (!pnl.isFullyClosed) {
      openTrades++;
    }

    // Track outcomes for closed trades
    if (pnl.isFullyClosed) {
      totalFullyClosedTrades++;
      closedTradePnls.push(netPnl);

      // Track duration
      if (pnl.durationMs !== null) {
        totalDuration += pnl.durationMs;
        if (shortestDuration === null || pnl.durationMs < shortestDuration) {
          shortestDuration = pnl.durationMs;
        }
        if (longestDuration === null || pnl.durationMs > longestDuration) {
          longestDuration = pnl.durationMs;
        }
      }

      if (pnl.outcome === "win") {
        numberOfWinningTrades++;
        sumWinningPnl = add(sumWinningPnl, netPnl);

        // Largest/smallest win
        if (largestWinPnl === null || greaterThan(netPnl, largestWinPnl)) {
          largestWinPnl = toDecimal(netPnl);
        }
        if (smallestWinPnl === null || lessThan(netPnl, smallestWinPnl)) {
          smallestWinPnl = toDecimal(netPnl);
        }

        // Duration for wins
        if (pnl.durationMs !== null) {
          totalWinDuration += pnl.durationMs;
          winDurationCount++;
        }

        // Streak tracking
        if (currentLossStreak > 0) {
          lossStreaks.push(currentLossStreak);
        }
        currentWinStreak++;
        currentLossStreak = 0;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else if (pnl.outcome === "loss") {
        numberOfLosingTrades++;
        sumLosingPnl = add(sumLosingPnl, netPnl);

        // Largest/smallest loss
        if (largestLossPnl === null || lessThan(netPnl, largestLossPnl)) {
          largestLossPnl = toDecimal(netPnl);
        }
        if (smallestLossPnl === null || greaterThan(netPnl, smallestLossPnl)) {
          smallestLossPnl = toDecimal(netPnl);
        }

        // Duration for losses
        if (pnl.durationMs !== null) {
          totalLossDuration += pnl.durationMs;
          lossDurationCount++;
        }

        // Streak tracking
        if (currentWinStreak > 0) {
          winStreaks.push(currentWinStreak);
        }
        currentLossStreak++;
        currentWinStreak = 0;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      } else {
        // Break even - end streaks but don't count
        if (currentWinStreak > 0) winStreaks.push(currentWinStreak);
        if (currentLossStreak > 0) lossStreaks.push(currentLossStreak);
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
        const closeDate = new Date(trade.closeDatetime);
        pnlPerTradeSeries.push({
          date: closeDate.getTime(),
          pnl: pnl.realizedNetPnl,
          isFullyClosed: true,
        });

        // Daily P&L aggregation
        const dayKey = closeDate.toISOString().split("T")[0]!;
        const existing = dailyPnlMap.get(dayKey) || { pnl: new Decimal(0), tradeCount: 0 };
        dailyPnlMap.set(dayKey, {
          pnl: add(existing.pnl, netPnl),
          tradeCount: existing.tradeCount + 1,
        });
      }
    }

    // Group by time periods
    if (trade.openDatetime) {
      const openDate = new Date(trade.openDatetime);
      const monthKey = openDate.toLocaleString("default", { month: "long", year: "numeric" });
      const dayKey = openDate.toLocaleString("default", { weekday: "long" });
      const hourKey = `${openDate.getHours().toString().padStart(2, "0")}:00`;
      const weekNum = getWeekNumber(openDate);
      const weekKey = `Week ${weekNum} ${openDate.getFullYear()}`;

      updateGroupedData(pnlByMonth, monthKey, netPnl, pnl.outcome);
      updateGroupedData(pnlByDayOfWeek, dayKey, netPnl, pnl.outcome);
      updateGroupedData(pnlByHourOfDay, hourKey, netPnl, pnl.outcome);
      updateGroupedData(pnlByWeekOfYear, weekKey, netPnl, pnl.outcome);
    }

    // Group by dimensions
    updateGroupedData(pnlByAssetClass, trade.assetClass, netPnl, pnl.outcome);
    if (trade.exchange) {
      updateGroupedData(pnlByExchange, trade.exchange, netPnl, pnl.outcome);
    }
    updateGroupedData(pnlByTradeDirection, trade.tradeDirection, netPnl, pnl.outcome);
  }

  // Final streak tracking
  if (currentWinStreak > 0) winStreaks.push(currentWinStreak);
  if (currentLossStreak > 0) lossStreaks.push(currentLossStreak);

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

  // Calculate payoff ratio (avg win / avg loss)
  const payoffRatio =
    avgWinPnlOverall && avgLossPnlOverall
      ? Math.abs(Number(avgWinPnlOverall) / Number(avgLossPnlOverall))
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

  // Calculate Kelly Criterion: K% = W - [(1-W)/R] where W = win rate, R = payoff ratio
  const kellyCriterion =
    winRateOverall !== null && payoffRatio !== null && payoffRatio > 0
      ? winRateOverall - (1 - winRateOverall) / payoffRatio
      : null;

  // Average streak lengths
  const averageWinStreak =
    winStreaks.length > 0
      ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length
      : null;
  const averageLoseStreak =
    lossStreaks.length > 0
      ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length
      : null;

  // Current streak status
  const currentStreak = currentWinStreak > 0 ? currentWinStreak : -currentLossStreak;
  const currentStreakType: "win" | "loss" | "none" =
    currentWinStreak > 0 ? "win" : currentLossStreak > 0 ? "loss" : "none";

  // Sort and calculate equity curve
  pnlPerTradeSeries.sort((a, b) => a.date - b.date);
  const equityCurve: EquityCurvePoint[] = [];
  let cumulativePnl = new Decimal(0);
  for (const point of pnlPerTradeSeries) {
    cumulativePnl = add(cumulativePnl, point.pnl);
    equityCurve.push({
      date: point.date,
      equity: toString(cumulativePnl),
    });
  }

  // Calculate drawdown metrics
  const drawdownAnalysis = calculateDrawdownAnalysis(equityCurve);

  // Calculate daily returns for Sharpe/Sortino
  const dailyReturns = calculateDailyReturns(dailyPnlMap);

  // Calculate volatility metrics
  const volatilityMetrics = calculateVolatilityMetrics(closedTradePnls, dailyReturns);

  // Calculate risk-adjusted returns
  const riskMetrics = calculateRiskAdjustedReturns(
    totalRealizedNetPnl,
    dailyReturns,
    drawdownAnalysis.maxDrawdownPercentage,
    volatilityMetrics.returnVolatility,
    volatilityMetrics.downsideDeviation,
    totalFullyClosedTrades
  );

  // Calculate statistical metrics
  const statisticalMetrics = calculateStatisticalMetrics(closedTradePnls);

  // Duration metrics
  const averageTradeDuration =
    totalFullyClosedTrades > 0 ? totalDuration / totalFullyClosedTrades : null;
  const averageWinningTradeDuration =
    winDurationCount > 0 ? totalWinDuration / winDurationCount : null;
  const averageLosingTradeDuration =
    lossDurationCount > 0 ? totalLossDuration / lossDurationCount : null;

  // Calculate win rates for grouped data
  const calculateWinRate = (data: GroupedPerformance) => {
    const decided = data.wins + data.losses;
    data.winRate = decided > 0 ? data.wins / decided : null;
  };

  const pnlByMonthArray = Array.from(pnlByMonth.values());
  const pnlByDayOfWeekArray = Array.from(pnlByDayOfWeek.values());
  const pnlByHourOfDayArray = Array.from(pnlByHourOfDay.values());
  const pnlByWeekOfYearArray = Array.from(pnlByWeekOfYear.values());
  const pnlByAssetClassArray = Array.from(pnlByAssetClass.values());
  const pnlByExchangeArray = Array.from(pnlByExchange.values());
  const pnlByStrategyArray = Array.from(pnlByStrategy.values());
  const pnlByTradeDirectionArray = Array.from(pnlByTradeDirection.values());

  [
    ...pnlByMonthArray,
    ...pnlByDayOfWeekArray,
    ...pnlByHourOfDayArray,
    ...pnlByAssetClassArray,
    ...pnlByExchangeArray,
    ...pnlByStrategyArray,
    ...pnlByTradeDirectionArray,
  ].forEach(calculateWinRate);

  // Sort grouped data by P&L
  const sortByPnl = (a: GroupedPerformance, b: GroupedPerformance) =>
    toDecimal(b.totalNetPnl).minus(toDecimal(a.totalNetPnl)).toNumber();

  pnlByAssetClassArray.sort(sortByPnl);
  pnlByExchangeArray.sort(sortByPnl);
  pnlByStrategyArray.sort(sortByPnl);
  pnlByTradeDirectionArray.sort(sortByPnl);

  // Find best/worst periods
  const pnlByMonthTimeData = pnlByMonthArray.map(toTimePerformance);
  const pnlByDayOfWeekTimeData = pnlByDayOfWeekArray.map(toTimePerformance);

  const bestTradingMonth = findBestPeriod(pnlByMonthTimeData);
  const worstTradingMonth = findWorstPeriod(pnlByMonthTimeData);
  const bestTradingDay = findBestPeriod(pnlByDayOfWeekTimeData);
  const worstTradingDay = findWorstPeriod(pnlByDayOfWeekTimeData);

  return {
    // Core P&L Metrics
    totalRealizedNetPnl: toString(totalRealizedNetPnl),
    totalRealizedGrossPnl: toString(totalRealizedGrossPnl),
    totalFeesPaidOnClosedPortions: toString(totalFeesPaidOnClosedPortions),
    totalUnrealizedPnl: hasUnrealized ? toString(totalUnrealizedPnl) : null,

    // Win/Loss Metrics
    winRateOverall,
    averageWinPnl: avgWinPnlOverall,
    averageLossPnl: avgLossPnlOverall,
    largestWinPnl: largestWinPnl ? toString(largestWinPnl) : null,
    largestLossPnl: largestLossPnl ? toString(largestLossPnl) : null,
    smallestWinPnl: smallestWinPnl ? toString(smallestWinPnl) : null,
    smallestLossPnl: smallestLossPnl ? toString(smallestLossPnl) : null,
    longestWinStreak,
    longestLoseStreak: longestLossStreak,
    averageWinStreak,
    averageLoseStreak: averageLoseStreak,
    numberOfWinningTrades,
    numberOfLosingTrades,
    numberOfBreakEvenTrades,
    totalFullyClosedTrades,

    // Trade Counts
    totalTrades: tradesWithPnl.length,
    closedTrades: totalFullyClosedTrades,
    openTrades,
    totalFees: toString(totalFees),

    // Risk-Adjusted Returns
    sharpeRatio: riskMetrics.sharpeRatio,
    sortinoRatio: riskMetrics.sortinoRatio,
    calmarRatio: riskMetrics.calmarRatio,
    recoveryFactor: riskMetrics.recoveryFactor,
    returnOnMaxDrawdown: riskMetrics.returnOnMaxDrawdown,

    // Performance Ratios
    avgRMultiple,
    profitFactor,
    expectancy,
    payoffRatio,
    kellyCriterion,

    // Volatility Metrics
    returnVolatility: volatilityMetrics.returnVolatility,
    downsideDeviation: volatilityMetrics.downsideDeviation,
    ulcerIndex: drawdownAnalysis.ulcerIndex,

    // Trade Duration Metrics
    averageTradeDuration,
    averageWinningTradeDuration,
    averageLosingTradeDuration,
    shortestTradeDuration: shortestDuration,
    longestTradeDuration: longestDuration,

    // Statistical Metrics
    medianPnl: statisticalMetrics.medianPnl,
    standardDeviationPnl: statisticalMetrics.standardDeviationPnl,
    skewness: statisticalMetrics.skewness,
    kurtosis: statisticalMetrics.kurtosis,

    // Consecutive Trades Analysis
    maxConsecutiveWins: longestWinStreak,
    maxConsecutiveLosses: longestLossStreak,
    currentStreak,
    currentStreakType,

    // Time-based Performance
    bestTradingDay,
    worstTradingDay,
    bestTradingMonth,
    worstTradingMonth,

    // Daily Returns
    dailyReturns,

    // Charts
    equityCurve,
    pnlPerTradeSeries,

    // Grouped Performance
    pnlByMonth: pnlByMonthTimeData,
    pnlByDayOfWeek: pnlByDayOfWeekTimeData,
    pnlByHourOfDay: pnlByHourOfDayArray.map(toTimePerformance),
    pnlByWeekOfYear: pnlByWeekOfYearArray.map(toTimePerformance),

    pnlByAssetClass: pnlByAssetClassArray,
    pnlByExchange: pnlByExchangeArray,
    pnlByStrategy: pnlByStrategyArray,
    pnlByEmotion: [], // To be implemented with emotion data
    pnlByTradeDirection: pnlByTradeDirectionArray,

    // Drawdown Analysis
    maxDrawdownPercentage: drawdownAnalysis.maxDrawdownPercentage,
    maxDrawdownDollar: drawdownAnalysis.maxDrawdownDollar,
    averageDrawdown: drawdownAnalysis.averageDrawdown,
    maxDrawdownDuration: drawdownAnalysis.maxDrawdownDuration,
    currentDrawdown: drawdownAnalysis.currentDrawdown,
    drawdownPeriods: drawdownAnalysis.drawdownPeriods,
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

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function findBestPeriod(periods: TimePerformanceData[]): TimePerformanceData | null {
  if (periods.length === 0) return null;
  return periods.reduce((best, current) =>
    Number(current.totalNetPnl) > Number(best.totalNetPnl) ? current : best
  );
}

function findWorstPeriod(periods: TimePerformanceData[]): TimePerformanceData | null {
  if (periods.length === 0) return null;
  return periods.reduce((worst, current) =>
    Number(current.totalNetPnl) < Number(worst.totalNetPnl) ? current : worst
  );
}

interface DrawdownAnalysisResult {
  maxDrawdownPercentage: string | null;
  maxDrawdownDollar: string | null;
  averageDrawdown: string | null;
  maxDrawdownDuration: number | null;
  currentDrawdown: string | null;
  ulcerIndex: number | null;
  drawdownPeriods: DrawdownPeriod[];
}

function calculateDrawdownAnalysis(equityCurve: EquityCurvePoint[]): DrawdownAnalysisResult {
  if (equityCurve.length === 0) {
    return {
      maxDrawdownPercentage: null,
      maxDrawdownDollar: null,
      averageDrawdown: null,
      maxDrawdownDuration: null,
      currentDrawdown: null,
      ulcerIndex: null,
      drawdownPeriods: [],
    };
  }

  let peak = new Decimal("-Infinity");
  let maxDrawdownPct = new Decimal(0);
  let maxDrawdownDollar = new Decimal(0);
  let sumDrawdownPctSquared = new Decimal(0);
  let drawdownCount = 0;
  let sumDrawdown = new Decimal(0);

  const drawdownPeriods: DrawdownPeriod[] = [];
  let currentDrawdownStart: number | null = null;
  let currentPeak = new Decimal(0);
  let maxDrawdownDuration = 0;
  let currentDrawdownDuration = 0;

  for (let i = 0; i < equityCurve.length; i++) {
    const point = equityCurve[i]!;
    const equity = toDecimal(point.equity);

    if (equity.greaterThan(peak)) {
      // New peak - end any current drawdown
      if (currentDrawdownStart !== null && drawdownPeriods.length > 0) {
        const lastPeriod = drawdownPeriods[drawdownPeriods.length - 1];
        if (lastPeriod && !lastPeriod.recovered) {
          lastPeriod.endDate = point.date;
          lastPeriod.recovered = true;
          lastPeriod.duration = point.date - lastPeriod.startDate;
        }
      }
      peak = equity;
      currentPeak = equity;
      currentDrawdownStart = null;
      currentDrawdownDuration = 0;
    } else if (peak.greaterThan(0)) {
      // In drawdown
      const drawdownPct = divide(subtract(equity, peak), peak);
      const drawdownDollarAmt = subtract(peak, equity);

      // Track max drawdown
      if (drawdownPct.lessThan(maxDrawdownPct)) {
        maxDrawdownPct = drawdownPct;
      }
      if (drawdownDollarAmt.greaterThan(maxDrawdownDollar)) {
        maxDrawdownDollar = drawdownDollarAmt;
      }

      // For Ulcer Index - sum of squared drawdowns
      sumDrawdownPctSquared = add(sumDrawdownPctSquared, multiply(drawdownPct, drawdownPct));
      sumDrawdown = add(sumDrawdown, drawdownPct.abs());
      drawdownCount++;

      // Track drawdown period
      if (currentDrawdownStart === null) {
        currentDrawdownStart = point.date;
        drawdownPeriods.push({
          startDate: point.date,
          endDate: null,
          peakEquity: toString(currentPeak),
          troughEquity: toString(equity),
          drawdownPercent: toString(multiply(drawdownPct.abs(), 100)),
          drawdownDollar: toString(drawdownDollarAmt),
          duration: 0,
          recovered: false,
        });
      } else {
        // Update current drawdown period
        const lastPeriod = drawdownPeriods[drawdownPeriods.length - 1];
        if (lastPeriod) {
          if (equity.lessThan(toDecimal(lastPeriod.troughEquity))) {
            lastPeriod.troughEquity = toString(equity);
            lastPeriod.drawdownPercent = toString(multiply(drawdownPct.abs(), 100));
            lastPeriod.drawdownDollar = toString(drawdownDollarAmt);
          }
        }
      }

      // Track duration
      if (i > 0) {
        const prevPoint = equityCurve[i - 1]!;
        currentDrawdownDuration += point.date - prevPoint.date;
        maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
      }
    }
  }

  // Calculate Ulcer Index: sqrt(mean of squared drawdowns)
  const ulcerIndex =
    equityCurve.length > 0
      ? Math.sqrt(divide(sumDrawdownPctSquared, equityCurve.length).toNumber()) * 100
      : null;

  // Calculate average drawdown
  const averageDrawdown =
    drawdownCount > 0
      ? toString(multiply(divide(sumDrawdown, drawdownCount), 100))
      : null;

  // Current drawdown (last point)
  let currentDrawdown: string | null = null;
  if (equityCurve.length > 0) {
    const lastEquity = toDecimal(equityCurve[equityCurve.length - 1]!.equity);
    if (peak.greaterThan(0) && lastEquity.lessThan(peak)) {
      const dd = divide(subtract(lastEquity, peak), peak);
      currentDrawdown = toString(multiply(dd.abs(), 100));
    } else {
      currentDrawdown = "0";
    }
  }

  return {
    maxDrawdownPercentage: toString(multiply(maxDrawdownPct.abs(), 100)),
    maxDrawdownDollar: toString(maxDrawdownDollar),
    averageDrawdown,
    maxDrawdownDuration: maxDrawdownDuration > 0 ? maxDrawdownDuration : null,
    currentDrawdown,
    ulcerIndex,
    drawdownPeriods,
  };
}

function calculateDailyReturns(
  dailyPnlMap: Map<string, { pnl: Decimal; tradeCount: number }>
): DailyReturnPoint[] {
  const sortedDays = Array.from(dailyPnlMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  const dailyReturns: DailyReturnPoint[] = [];
  let cumulativePnl = new Decimal(0);

  for (const [dateStr, data] of sortedDays) {
    cumulativePnl = add(cumulativePnl, data.pnl);
    dailyReturns.push({
      date: new Date(dateStr).getTime(),
      pnl: toString(data.pnl),
      tradeCount: data.tradeCount,
      cumulativePnl: toString(cumulativePnl),
    });
  }

  return dailyReturns;
}

interface VolatilityMetrics {
  returnVolatility: number | null;
  downsideDeviation: number | null;
}

function calculateVolatilityMetrics(
  tradePnls: Decimal[],
  dailyReturns: DailyReturnPoint[]
): VolatilityMetrics {
  if (tradePnls.length < 2) {
    return { returnVolatility: null, downsideDeviation: null };
  }

  // Calculate standard deviation of trade returns
  const returns = tradePnls.map((p) => p.toNumber());
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map((r) => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
  const returnVolatility = Math.sqrt(variance);

  // Calculate downside deviation (std dev of negative returns only)
  const negativeReturns = returns.filter((r) => r < 0);
  let downsideDeviation: number | null = null;
  if (negativeReturns.length > 0) {
    const negSquaredDiffs = negativeReturns.map((r) => Math.pow(r, 2));
    const negVariance = negSquaredDiffs.reduce((a, b) => a + b, 0) / negativeReturns.length;
    downsideDeviation = Math.sqrt(negVariance);
  }

  return { returnVolatility, downsideDeviation };
}

interface RiskAdjustedReturns {
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  recoveryFactor: number | null;
  returnOnMaxDrawdown: number | null;
}

function calculateRiskAdjustedReturns(
  totalPnl: Decimal,
  dailyReturns: DailyReturnPoint[],
  maxDrawdownPct: string | null,
  returnVolatility: number | null,
  downsideDeviation: number | null,
  totalTrades: number
): RiskAdjustedReturns {
  const result: RiskAdjustedReturns = {
    sharpeRatio: null,
    sortinoRatio: null,
    calmarRatio: null,
    recoveryFactor: null,
    returnOnMaxDrawdown: null,
  };

  if (dailyReturns.length < 2 || totalTrades === 0) {
    return result;
  }

  // Calculate average daily return
  const dailyPnls = dailyReturns.map((d) => Number(d.pnl));
  const avgDailyReturn = dailyPnls.reduce((a, b) => a + b, 0) / dailyPnls.length;

  // Daily risk-free rate
  const dailyRiskFreeRate = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;

  // Calculate daily volatility
  if (dailyPnls.length > 1) {
    const dailyMean = avgDailyReturn;
    const dailySquaredDiffs = dailyPnls.map((r) => Math.pow(r - dailyMean, 2));
    const dailyVariance = dailySquaredDiffs.reduce((a, b) => a + b, 0) / dailyPnls.length;
    const dailyStdDev = Math.sqrt(dailyVariance);

    // Sharpe Ratio (annualized)
    if (dailyStdDev > 0) {
      const excessReturn = avgDailyReturn - dailyRiskFreeRate;
      result.sharpeRatio = (excessReturn / dailyStdDev) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    }

    // Sortino Ratio (annualized)
    const negativeDailyReturns = dailyPnls.filter((r) => r < dailyRiskFreeRate);
    if (negativeDailyReturns.length > 0) {
      const negSquaredDiffs = negativeDailyReturns.map((r) =>
        Math.pow(r - dailyRiskFreeRate, 2)
      );
      const downsideVar = negSquaredDiffs.reduce((a, b) => a + b, 0) / negativeDailyReturns.length;
      const downsideDev = Math.sqrt(downsideVar);
      if (downsideDev > 0) {
        const excessReturn = avgDailyReturn - dailyRiskFreeRate;
        result.sortinoRatio = (excessReturn / downsideDev) * Math.sqrt(TRADING_DAYS_PER_YEAR);
      }
    }
  }

  // Calmar Ratio, Recovery Factor, ROMAD
  if (maxDrawdownPct && Number(maxDrawdownPct) > 0) {
    const maxDD = Number(maxDrawdownPct);
    const totalReturn = totalPnl.toNumber();

    // Annualized return estimation
    const tradingDays = dailyReturns.length;
    const annualizedReturn =
      tradingDays > 0 ? (totalReturn / tradingDays) * TRADING_DAYS_PER_YEAR : 0;

    // Calmar Ratio = Annualized Return / Max Drawdown %
    result.calmarRatio = annualizedReturn / maxDD;

    // Recovery Factor = Total Profit / Max Drawdown (in dollars, approximated)
    // Using % here since we track drawdown in percentage
    result.recoveryFactor = totalReturn > 0 ? totalReturn / (maxDD / 100 * totalReturn) : null;

    // ROMAD
    result.returnOnMaxDrawdown = totalReturn / maxDD;
  }

  return result;
}

interface StatisticalMetrics {
  medianPnl: string | null;
  standardDeviationPnl: string | null;
  skewness: number | null;
  kurtosis: number | null;
}

function calculateStatisticalMetrics(tradePnls: Decimal[]): StatisticalMetrics {
  if (tradePnls.length === 0) {
    return {
      medianPnl: null,
      standardDeviationPnl: null,
      skewness: null,
      kurtosis: null,
    };
  }

  const returns = tradePnls.map((p) => p.toNumber()).sort((a, b) => a - b);
  const n = returns.length;

  // Median
  const medianPnl =
    n % 2 === 0
      ? ((returns[n / 2 - 1]! + returns[n / 2]!) / 2).toString()
      : returns[Math.floor(n / 2)]!.toString();

  // Mean and Standard Deviation
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const squaredDiffs = returns.map((r) => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(variance);
  const standardDeviationPnl = stdDev.toString();

  // Skewness: E[(X - μ)³] / σ³
  let skewness: number | null = null;
  if (n >= 3 && stdDev > 0) {
    const cubedDiffs = returns.map((r) => Math.pow((r - mean) / stdDev, 3));
    skewness = cubedDiffs.reduce((a, b) => a + b, 0) / n;
  }

  // Kurtosis: E[(X - μ)⁴] / σ⁴ - 3 (excess kurtosis)
  let kurtosis: number | null = null;
  if (n >= 4 && stdDev > 0) {
    const fourthPowerDiffs = returns.map((r) => Math.pow((r - mean) / stdDev, 4));
    kurtosis = fourthPowerDiffs.reduce((a, b) => a + b, 0) / n - 3;
  }

  return {
    medianPnl,
    standardDeviationPnl,
    skewness,
    kurtosis,
  };
}
