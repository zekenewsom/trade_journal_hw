import { api } from "@/trpc/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EquityCurveChart } from "@/components/charts/equity-curve";
import { formatCurrency, formatPercent, formatNumber, formatDuration } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  BarChart3,
  Clock,
  AlertTriangle,
  Award,
  Flame,
  Calculator,
  LineChart,
  PieChart,
  Gauge,
  Zap,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Helper to format ratio values
function formatRatio(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "N/A";
  return value.toFixed(decimals);
}

// Helper to get color class based on value
function getColorClass(value: number | null | undefined, invert = false): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (invert) {
    return value > 0 ? "text-red-500" : value < 0 ? "text-green-500" : "text-muted-foreground";
  }
  return value > 0 ? "text-green-500" : value < 0 ? "text-red-500" : "text-muted-foreground";
}

// Metric card component for consistent styling
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueColor,
  tooltip,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  valueColor?: "green" | "red" | "default" | "auto";
  tooltip?: string;
}) {
  let colorClass = "text-foreground";
  if (valueColor === "green") colorClass = "text-green-500";
  if (valueColor === "red") colorClass = "text-red-500";
  if (valueColor === "auto") {
    const numValue = parseFloat(value.replace(/[^0-9.-]/g, ""));
    colorClass = numValue > 0 ? "text-green-500" : numValue < 0 ? "text-red-500" : "text-muted-foreground";
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        <span title={tooltip}>{title}</span>
      </div>
      <div className={cn("text-lg font-semibold", colorClass)}>{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export async function AnalyticsDashboard() {
  const analytics = await api.analytics.summary();

  if (!analytics) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No analytics data available. Import some trades to get started.
      </div>
    );
  }

  const totalPnl = Number(analytics.totalRealizedNetPnl) || 0;
  const closedTrades = analytics.closedTrades ?? 0;
  const openTrades = analytics.openTrades ?? 0;
  const hasData = closedTrades > 0;

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Net P&L</CardTitle>
            {totalPnl >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", totalPnl >= 0 ? "text-green-500" : "text-red-500")}>
              {formatCurrency(totalPnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gross: {formatCurrency(analytics.totalRealizedGrossPnl)} | Fees: {formatCurrency(analytics.totalFees)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.winRateOverall !== null ? formatPercent(analytics.winRateOverall) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.numberOfWinningTrades ?? 0}W / {analytics.numberOfLosingTrades ?? 0}L / {analytics.numberOfBreakEvenTrades ?? 0}BE
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", (analytics.profitFactor ?? 0) >= 1 ? "text-green-500" : "text-red-500")}>
              {formatRatio(analytics.profitFactor)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(analytics.profitFactor ?? 0) >= 2 ? "Excellent" : (analytics.profitFactor ?? 0) >= 1.5 ? "Good" : (analytics.profitFactor ?? 0) >= 1 ? "Break Even" : "Negative Edge"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              -{formatNumber(analytics.maxDrawdownPercentage ?? "0", { maximumFractionDigits: 2 })}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current: -{formatNumber(analytics.currentDrawdown ?? "0", { maximumFractionDigits: 2 })}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Equity Curve
          </CardTitle>
          <CardDescription>Cumulative P&L over time</CardDescription>
        </CardHeader>
        <CardContent>
          <EquityCurveChart data={analytics.equityCurve ?? []} />
        </CardContent>
      </Card>

      {/* Risk-Adjusted Returns - Institutional Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Risk-Adjusted Performance
          </CardTitle>
          <CardDescription>Institutional-grade performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <MetricCard
              title="Sharpe Ratio"
              value={formatRatio(analytics.sharpeRatio)}
              subtitle={analytics.sharpeRatio !== null && analytics.sharpeRatio > 1 ? "Good risk-adjusted" : analytics.sharpeRatio !== null && analytics.sharpeRatio > 2 ? "Excellent" : ""}
              icon={BarChart3}
              tooltip="Risk-adjusted return (annualized)"
            />
            <MetricCard
              title="Sortino Ratio"
              value={formatRatio(analytics.sortinoRatio)}
              subtitle="Downside risk-adjusted"
              icon={BarChart3}
              tooltip="Return adjusted for downside volatility only"
            />
            <MetricCard
              title="Calmar Ratio"
              value={formatRatio(analytics.calmarRatio)}
              subtitle="Return / Max DD"
              icon={BarChart3}
              tooltip="Annualized return divided by max drawdown"
            />
            <MetricCard
              title="Recovery Factor"
              value={formatRatio(analytics.recoveryFactor)}
              subtitle="Profit / Drawdown"
              icon={ArrowUpRight}
              tooltip="Total profit divided by max drawdown"
            />
            <MetricCard
              title="Ulcer Index"
              value={formatRatio(analytics.ulcerIndex)}
              subtitle="Drawdown severity"
              icon={AlertTriangle}
              tooltip="Measure of drawdown depth and duration"
            />
          </div>
        </CardContent>
      </Card>

      {/* Trade Statistics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Trade Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                title="Total Trades"
                value={closedTrades.toString()}
                subtitle={`${openTrades} open`}
                icon={BarChart3}
              />
              <MetricCard
                title="Expectancy"
                value={formatCurrency(analytics.expectancy)}
                subtitle="Avg expected P&L per trade"
                icon={Calculator}
                valueColor="auto"
              />
              <MetricCard
                title="Payoff Ratio"
                value={formatRatio(analytics.payoffRatio)}
                subtitle="Avg Win / Avg Loss"
                icon={Scale}
              />
              <MetricCard
                title="Kelly Criterion"
                value={analytics.kellyCriterion !== null ? formatPercent(analytics.kellyCriterion) : "N/A"}
                subtitle="Optimal position size"
                icon={Calculator}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Win/Loss Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                title="Average Win"
                value={formatCurrency(analytics.averageWinPnl)}
                subtitle={`Largest: ${formatCurrency(analytics.largestWinPnl)}`}
                icon={ArrowUpRight}
                valueColor="green"
              />
              <MetricCard
                title="Average Loss"
                value={formatCurrency(analytics.averageLossPnl)}
                subtitle={`Largest: ${formatCurrency(analytics.largestLossPnl)}`}
                icon={ArrowDownRight}
                valueColor="red"
              />
              <MetricCard
                title="Median P&L"
                value={formatCurrency(analytics.medianPnl)}
                subtitle={`Std Dev: ${formatCurrency(analytics.standardDeviationPnl)}`}
                icon={Minus}
                valueColor="auto"
              />
              <MetricCard
                title="Volatility"
                value={analytics.returnVolatility !== null ? formatCurrency(analytics.returnVolatility) : "N/A"}
                subtitle="Return std deviation"
                icon={Zap}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Streaks and Duration */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Streak Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                title="Max Win Streak"
                value={`${analytics.maxConsecutiveWins ?? 0} trades`}
                subtitle={analytics.averageWinStreak != null ? `Avg: ${analytics.averageWinStreak.toFixed(1)}` : undefined}
                icon={TrendingUp}
                valueColor="green"
              />
              <MetricCard
                title="Max Loss Streak"
                value={`${analytics.maxConsecutiveLosses ?? 0} trades`}
                subtitle={analytics.averageLoseStreak != null ? `Avg: ${analytics.averageLoseStreak.toFixed(1)}` : undefined}
                icon={TrendingDown}
                valueColor="red"
              />
              <MetricCard
                title="Current Streak"
                value={`${Math.abs(analytics.currentStreak ?? 0)} ${analytics.currentStreakType === "win" ? "wins" : analytics.currentStreakType === "loss" ? "losses" : "none"}`}
                icon={analytics.currentStreakType === "win" ? TrendingUp : analytics.currentStreakType === "loss" ? TrendingDown : Minus}
                valueColor={analytics.currentStreakType === "win" ? "green" : analytics.currentStreakType === "loss" ? "red" : "default"}
              />
              <div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Trade Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                title="Average Duration"
                value={formatDuration(analytics.averageTradeDuration)}
                icon={Clock}
              />
              <MetricCard
                title="Avg Winning Trade"
                value={formatDuration(analytics.averageWinningTradeDuration)}
                icon={TrendingUp}
                valueColor="green"
              />
              <MetricCard
                title="Avg Losing Trade"
                value={formatDuration(analytics.averageLosingTradeDuration)}
                icon={TrendingDown}
                valueColor="red"
              />
              <MetricCard
                title="Longest Trade"
                value={formatDuration(analytics.longestTradeDuration)}
                subtitle={`Shortest: ${formatDuration(analytics.shortestTradeDuration)}`}
                icon={Clock}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistical Analysis */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Statistical Distribution
            </CardTitle>
            <CardDescription>Return distribution characteristics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <MetricCard
                title="Skewness"
                value={formatRatio(analytics.skewness, 3)}
                subtitle={analytics.skewness !== null ? (analytics.skewness > 0 ? "Right-skewed (positive tail)" : analytics.skewness < 0 ? "Left-skewed (negative tail)" : "Symmetric") : undefined}
                icon={BarChart3}
              />
              <MetricCard
                title="Kurtosis"
                value={formatRatio(analytics.kurtosis, 3)}
                subtitle={analytics.kurtosis !== null ? (analytics.kurtosis > 0 ? "Fat tails (leptokurtic)" : analytics.kurtosis < 0 ? "Thin tails (platykurtic)" : "Normal") : undefined}
                icon={BarChart3}
              />
              <MetricCard
                title="Downside Deviation"
                value={analytics.downsideDeviation !== null ? formatCurrency(analytics.downsideDeviation) : "N/A"}
                subtitle="Volatility of losses"
                icon={ArrowDownRight}
              />
              <MetricCard
                title="Avg R-Multiple"
                value={analytics.avgRMultiple !== null ? formatRatio(Number(analytics.avgRMultiple)) : "N/A"}
                subtitle="If R is tracked"
                icon={Scale}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best/Worst Performance */}
      {(analytics.bestTradingDay || analytics.bestTradingMonth) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-green-500" />
                Best Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics.bestTradingMonth && (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Best Month</p>
                    <p className="text-xs text-muted-foreground">{analytics.bestTradingMonth.period}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-500">
                      {formatCurrency(analytics.bestTradingMonth.totalNetPnl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {analytics.bestTradingMonth.tradeCount} trades ({analytics.bestTradingMonth.wins}W)
                    </p>
                  </div>
                </div>
              )}
              {analytics.bestTradingDay && (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Best Day</p>
                    <p className="text-xs text-muted-foreground">{analytics.bestTradingDay.period}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-500">
                      {formatCurrency(analytics.bestTradingDay.totalNetPnl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Win Rate: {analytics.bestTradingDay.winRate !== null ? formatPercent(analytics.bestTradingDay.winRate) : "N/A"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Worst Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics.worstTradingMonth && (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Worst Month</p>
                    <p className="text-xs text-muted-foreground">{analytics.worstTradingMonth.period}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-500">
                      {formatCurrency(analytics.worstTradingMonth.totalNetPnl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {analytics.worstTradingMonth.tradeCount} trades ({analytics.worstTradingMonth.losses}L)
                    </p>
                  </div>
                </div>
              )}
              {analytics.worstTradingDay && (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Worst Day</p>
                    <p className="text-xs text-muted-foreground">{analytics.worstTradingDay.period}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-500">
                      {formatCurrency(analytics.worstTradingDay.totalNetPnl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Win Rate: {analytics.worstTradingDay.winRate !== null ? formatPercent(analytics.worstTradingDay.winRate) : "N/A"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance by Category */}
      <div className="grid gap-4 md:grid-cols-2">
        {analytics.pnlByAssetClass && analytics.pnlByAssetClass.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                P&L by Asset Class
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.pnlByAssetClass.map((item) => (
                  <div key={item.name} className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium capitalize">{item.name.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.tradeCount} trades | Win Rate: {item.winRate !== null ? formatPercent(item.winRate) : "N/A"}
                      </p>
                    </div>
                    <p className={cn("font-semibold", getColorClass(Number(item.totalNetPnl)))}>
                      {formatCurrency(item.totalNetPnl)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {analytics.pnlByTradeDirection && analytics.pnlByTradeDirection.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                P&L by Direction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.pnlByTradeDirection.map((item) => (
                  <div key={item.name} className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium capitalize">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.tradeCount} trades | {item.wins}W / {item.losses}L
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-semibold", getColorClass(Number(item.totalNetPnl)))}>
                        {formatCurrency(item.totalNetPnl)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.winRate !== null ? formatPercent(item.winRate) : "N/A"} win rate
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Monthly Performance */}
      {analytics.pnlByMonth && analytics.pnlByMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Monthly Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {analytics.pnlByMonth.slice(0, 12).map((month) => (
                <div key={month.period} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{month.period}</p>
                  <p className={cn("text-lg font-semibold", getColorClass(Number(month.totalNetPnl)))}>
                    {formatCurrency(month.totalNetPnl)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {month.tradeCount} trades | {month.winRate !== null ? formatPercent(month.winRate) : "N/A"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day of Week Performance */}
      {analytics.pnlByDayOfWeek && analytics.pnlByDayOfWeek.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance by Day of Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                .map((day) => analytics.pnlByDayOfWeek.find((d) => d.period === day))
                .filter(Boolean)
                .map((day) => (
                  <div key={day!.period} className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">{day!.period.slice(0, 3)}</p>
                    <p className={cn("text-sm font-semibold", getColorClass(Number(day!.totalNetPnl)))}>
                      {formatCurrency(day!.totalNetPnl)}
                    </p>
                    <p className="text-xs text-muted-foreground">{day!.tradeCount} trades</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hour of Day Performance */}
      {analytics.pnlByHourOfDay && analytics.pnlByHourOfDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Performance by Hour
            </CardTitle>
            <CardDescription>Trading hour analysis (based on trade open time)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {analytics.pnlByHourOfDay
                .sort((a, b) => a.period.localeCompare(b.period))
                .map((hour) => (
                  <div key={hour.period} className="p-2 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">{hour.period}</p>
                    <p className={cn("text-xs font-semibold", getColorClass(Number(hour.totalNetPnl)))}>
                      {formatCurrency(hour.totalNetPnl)}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
