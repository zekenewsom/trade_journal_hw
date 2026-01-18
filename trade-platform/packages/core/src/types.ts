export type TradeDirection = "long" | "short";
export type TradeStatus = "open" | "closed";
export type TradeOutcome = "win" | "loss" | "break_even";
export type TransactionAction = "buy" | "sell";
export type AssetClass =
  | "stock"
  | "cryptocurrency"
  | "forex"
  | "futures"
  | "options"
  | "prediction_market";

// Institutional-grade trade review types
export type ThesisValidation = "correct" | "partial" | "incorrect";
export type PlanAdherence = "high" | "medium" | "low";

export interface TransactionData {
  id: string;
  tradeId: string;
  action: TransactionAction;
  quantity: string; // Stored as string for Decimal.js precision
  price: string;
  datetime: Date;
  fees: string;
  notes?: string | null;
}

export interface TradeData {
  id: string;
  instrumentTicker: string;
  assetClass: AssetClass;
  exchange?: string | null;
  tradeDirection: TradeDirection;
  status: TradeStatus;
  openDatetime?: Date | null;
  closeDatetime?: Date | null;
  feesTotal: string;
  realizedPnl?: string | null;
  unrealizedPnl?: string | null;
  currentOpenQuantity?: string | null;
  averageOpenPrice?: string | null;
  currentMarketPrice?: string | null;
  rMultipleInitialRisk?: string | null;
  transactions?: TransactionData[];

  // Institutional-grade qualitative fields
  thesisValidation?: ThesisValidation | null;
  planAdherence?: PlanAdherence | null;
  planAdherenceNotes?: string | null;
  unforeseenEvents?: string | null;
  overallRating?: number | null;
  outcomeOverride?: TradeOutcome | null;
  keyLesson1?: string | null;
  keyLesson2?: string | null;
  keyLesson3?: string | null;

  // Quantitative metrics
  returnOnAllocatedCapital?: string | null;
  maxCapitalUsed?: string | null;
  decisionPrice?: string | null;
  implementationShortfall?: string | null;
}

export interface PnlCalculationResult {
  tradeId: string;
  realizedGrossPnl: string;
  realizedNetPnl: string;
  feesAttributableToClosedPortion: string;
  isFullyClosed: boolean;
  closedQuantity: string;
  openQuantity: string;
  averageOpenPrice: string | null;
  unrealizedGrossPnl: string | null;
  rMultipleActual: string | null;
  durationMs: number | null;
  outcome: TradeOutcome | null;
}

export interface AnalyticsFilters {
  dateRange?: {
    startDate?: Date | null;
    endDate?: Date | null;
  };
  assetClasses?: AssetClass[];
  exchanges?: string[];
  strategyIds?: string[];
}

export interface TimePerformanceData {
  period: string;
  totalNetPnl: string;
  tradeCount: number;
  winRate: number | null;
  wins: number;
  losses: number;
  breakEvens: number;
}

export interface GroupedPerformance {
  name: string;
  totalNetPnl: string;
  winRate: number | null;
  tradeCount: number;
  wins: number;
  losses: number;
  breakEvens: number;
}

export interface EquityCurvePoint {
  date: number; // Unix timestamp
  equity: string;
}

export interface PnlPerTradePoint {
  date: number;
  pnl: string;
  isFullyClosed: boolean;
}

export interface AnalyticsData {
  // Core P&L Metrics
  totalRealizedNetPnl: string;
  totalRealizedGrossPnl: string;
  totalFeesPaidOnClosedPortions: string;
  totalUnrealizedPnl: string | null;
  totalFees: string;

  // Trade Counts
  totalTrades: number;
  closedTrades: number;
  openTrades: number;

  // Win/Loss Metrics
  winRateOverall: number | null;
  averageWinPnl: string | null;
  averageLossPnl: string | null;
  largestWinPnl: string | null;
  largestLossPnl: string | null;
  smallestWinPnl: string | null;
  smallestLossPnl: string | null;
  longestWinStreak: number;
  longestLoseStreak: number;
  averageWinStreak: number | null;
  averageLoseStreak: number | null;
  numberOfWinningTrades: number;
  numberOfLosingTrades: number;
  numberOfBreakEvenTrades: number;
  totalFullyClosedTrades: number;

  // Risk-Adjusted Returns (Institutional Metrics)
  sharpeRatio: number | null;         // (Avg Return - Risk Free Rate) / Std Dev of Returns
  sortinoRatio: number | null;        // (Avg Return - Risk Free Rate) / Downside Deviation
  calmarRatio: number | null;         // Annualized Return / Max Drawdown
  recoveryFactor: number | null;      // Net Profit / Max Drawdown
  returnOnMaxDrawdown: number | null; // ROMAD - similar to recovery factor

  // Performance Ratios
  avgRMultiple: string | null;
  profitFactor: number | null;
  expectancy: string | null;
  payoffRatio: number | null;         // Avg Win / Avg Loss (also called Win/Loss Ratio)
  kellyCriterion: number | null;      // Optimal position size percentage

  // Volatility Metrics
  returnVolatility: number | null;    // Standard deviation of trade returns
  downsideDeviation: number | null;   // Std dev of negative returns only
  ulcerIndex: number | null;          // Measure of drawdown severity

  // Trade Duration Metrics
  averageTradeDuration: number | null;       // Average holding period in ms
  averageWinningTradeDuration: number | null;
  averageLosingTradeDuration: number | null;
  shortestTradeDuration: number | null;
  longestTradeDuration: number | null;

  // Additional Statistics
  medianPnl: string | null;
  standardDeviationPnl: string | null;
  skewness: number | null;            // Distribution asymmetry
  kurtosis: number | null;            // Distribution tail heaviness

  // Consecutive Trades Analysis
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  currentStreak: number;              // Positive for wins, negative for losses
  currentStreakType: "win" | "loss" | "none";

  // Time-based Performance
  bestTradingDay: TimePerformanceData | null;
  worstTradingDay: TimePerformanceData | null;
  bestTradingMonth: TimePerformanceData | null;
  worstTradingMonth: TimePerformanceData | null;

  // Daily Returns for advanced calculations
  dailyReturns: DailyReturnPoint[];

  equityCurve: EquityCurvePoint[];
  pnlPerTradeSeries: PnlPerTradePoint[];

  pnlByMonth: TimePerformanceData[];
  pnlByDayOfWeek: TimePerformanceData[];
  pnlByHourOfDay: TimePerformanceData[];
  pnlByWeekOfYear: TimePerformanceData[];

  pnlByAssetClass: GroupedPerformance[];
  pnlByExchange: GroupedPerformance[];
  pnlByStrategy: GroupedPerformance[];
  pnlByEmotion: GroupedPerformance[];
  pnlByTradeDirection: GroupedPerformance[];
  pnlByThesisValidation: GroupedPerformance[];
  pnlByPlanAdherence: GroupedPerformance[];

  // Qualitative Metrics Aggregation
  averageOverallRating: number | null;
  thesisValidationDistribution: {
    correct: number;
    partial: number;
    incorrect: number;
  };
  planAdherenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  ratingPnlCorrelation: number | null;

  // Drawdown Analysis
  maxDrawdownPercentage: string | null;
  maxDrawdownDollar: string | null;
  averageDrawdown: string | null;
  maxDrawdownDuration: number | null; // Duration in ms
  currentDrawdown: string | null;
  drawdownPeriods: DrawdownPeriod[];
}

export interface DailyReturnPoint {
  date: number; // Unix timestamp
  pnl: string;
  tradeCount: number;
  cumulativePnl: string;
}

export interface DrawdownPeriod {
  startDate: number;
  endDate: number | null;  // null if still in drawdown
  peakEquity: string;
  troughEquity: string;
  drawdownPercent: string;
  drawdownDollar: string;
  duration: number;        // in ms
  recovered: boolean;
}
