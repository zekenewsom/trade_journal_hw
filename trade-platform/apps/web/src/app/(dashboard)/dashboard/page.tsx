import { Suspense } from "react";
import { TrendingUp, TrendingDown, Activity, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EquityCurveChart } from "@/components/charts/equity-curve";
import { RecentTradesTable } from "@/components/dashboard/recent-trades";
import { api } from "@/trpc/server";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const analytics = await api.analytics.summary();

  // Parse string values to numbers for comparisons
  const totalPnl = Number(analytics.totalRealizedNetPnl) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your trading performance at a glance
        </p>
      </div>

      {/* Metrics Cards */}
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
                totalPnl >= 0
                  ? "text-green-500"
                  : "text-red-500"
              )}
            >
              {formatCurrency(totalPnl)}
            </div>
            <p className="text-xs text-muted-foreground">
              Realized P&L from {analytics.totalFullyClosedTrades} closed trades
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
              {analytics.winRateOverall !== null
                ? formatPercent(analytics.winRateOverall)
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.numberOfWinningTrades}W / {analytics.numberOfLosingTrades}L / {analytics.numberOfBreakEvenTrades}BE
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
              {analytics.avgWinPnlOverall !== null
                ? formatCurrency(Number(analytics.avgWinPnlOverall))
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Largest: {analytics.largestWinPnl !== null
                ? formatCurrency(Number(analytics.largestWinPnl))
                : "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Loss</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {analytics.avgLossPnlOverall !== null
                ? formatCurrency(Number(analytics.avgLossPnlOverall))
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Largest: {analytics.largestLossPnl !== null
                ? formatCurrency(Number(analytics.largestLossPnl))
                : "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve */}
      <Card>
        <CardHeader>
          <CardTitle>Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-[300px] animate-pulse bg-muted rounded" />}>
            <EquityCurveChart data={analytics.equityCurve} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Longest Win Streak</dt>
                <dd className="font-medium text-green-500">
                  {analytics.longestWinStreak} trades
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Longest Loss Streak</dt>
                <dd className="font-medium text-red-500">
                  {analytics.longestLossStreak} trades
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Max Drawdown</dt>
                <dd className="font-medium">
                  {analytics.maxDrawdownPercentage !== null
                    ? `${Number(analytics.maxDrawdownPercentage).toFixed(2)}%`
                    : "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Fees Paid</dt>
                <dd className="font-medium">
                  {formatCurrency(Number(analytics.totalFeesPaidOnClosedPortions))}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-[200px] animate-pulse bg-muted rounded" />}>
              <RecentTradesTable />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
