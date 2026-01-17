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
    startDate: Date | null;
    endDate: Date | null;
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
  totalRealizedNetPnl: string;
  totalRealizedGrossPnl: string;
  totalFeesPaidOnClosedPortions: string;
  totalUnrealizedPnl: string | null;

  winRateOverall: number | null;
  avgWinPnlOverall: string | null;
  avgLossPnlOverall: string | null;
  largestWinPnl: string | null;
  largestLossPnl: string | null;
  longestWinStreak: number;
  longestLossStreak: number;
  numberOfWinningTrades: number;
  numberOfLosingTrades: number;
  numberOfBreakEvenTrades: number;
  totalFullyClosedTrades: number;
  avgRMultiple: string | null;

  equityCurve: EquityCurvePoint[];
  pnlPerTradeSeries: PnlPerTradePoint[];

  pnlByMonth: TimePerformanceData[];
  pnlByDayOfWeek: TimePerformanceData[];

  pnlByAssetClass: GroupedPerformance[];
  pnlByExchange: GroupedPerformance[];
  pnlByStrategy: GroupedPerformance[];
  pnlByEmotion: GroupedPerformance[];

  maxDrawdownPercentage: string | null;
}
