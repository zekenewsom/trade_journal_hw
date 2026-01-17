import { api } from "@/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EquityCurveChart } from "@/components/charts/equity-curve";
import { formatCurrency, formatPercent } from "@/lib/format";
import { TrendingUp, TrendingDown, Target, Activity, BarChart3, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            {totalPnl >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                totalPnl >= 0 ? "text-green-500" : "text-red-500"
              )}
            >
              {formatCurrency(totalPnl)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.winRateOverall !== null
                ? formatPercent(analytics.winRateOverall)
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.numberOfWinningTrades}W / {analytics.numberOfLosingTrades}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Win</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {analytics.averageWinPnl
                ? formatCurrency(Number(analytics.averageWinPnl))
                : "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Loss</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {analytics.averageLossPnl
                ? formatCurrency(Number(analytics.averageLossPnl))
                : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Equity Curve
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EquityCurveChart data={analytics.equityCurve} />
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Trades</dt>
                <dd className="font-medium">{analytics.totalFullyClosedTrades}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Winning Trades</dt>
                <dd className="font-medium text-green-500">
                  {analytics.numberOfWinningTrades}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Losing Trades</dt>
                <dd className="font-medium text-red-500">
                  {analytics.numberOfLosingTrades}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Break Even</dt>
                <dd className="font-medium">{analytics.numberOfBreakEvenTrades}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Risk Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Max Drawdown</dt>
                <dd className="font-medium">
                  {analytics.maxDrawdownPercentage
                    ? `${Number(analytics.maxDrawdownPercentage).toFixed(2)}%`
                    : "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Longest Win Streak</dt>
                <dd className="font-medium text-green-500">
                  {analytics.longestWinStreak} trades
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Longest Loss Streak</dt>
                <dd className="font-medium text-red-500">
                  {analytics.longestLoseStreak} trades
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Largest Win</dt>
                <dd className="font-medium text-green-500">
                  {analytics.largestWinPnl
                    ? formatCurrency(Number(analytics.largestWinPnl))
                    : "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Largest Loss</dt>
                <dd className="font-medium text-red-500">
                  {analytics.largestLossPnl
                    ? formatCurrency(Number(analytics.largestLossPnl))
                    : "N/A"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
