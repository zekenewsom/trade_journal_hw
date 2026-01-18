"use client";

import { TrendingUp, TrendingDown, Activity, Target, DollarSign, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EquityCurveChart } from "@/components/charts/equity-curve";
import { RecentTradesTable } from "@/components/dashboard/recent-trades";
import { api } from "@/trpc/react";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DashboardContent() {
  const { data: analytics, isLoading, error } = api.analytics.getSummary.useQuery();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Failed to load analytics. Please try again.
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No analytics data available. Import some trades to get started.
      </div>
    );
  }

  const totalPnl = parseFloat(analytics.totalRealizedNetPnl) || 0;
  const winRate = analytics.winRateOverall || 0;

  return (
    <>
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
                totalPnl >= 0 ? "text-green-500" : "text-red-500"
              )}
            >
              {formatCurrency(totalPnl)}
            </div>
            <p className="text-xs text-muted-foreground">
              Realized P&L from {analytics.closedTrades} closed trades
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
              {winRate !== null ? formatPercent(winRate) : "N/A"}
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
              {formatCurrency(analytics.averageWinPnl)}
            </div>
            <p className="text-xs text-muted-foreground">
              Largest: {formatCurrency(analytics.largestWinPnl)}
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
              {formatCurrency(analytics.averageLossPnl)}
            </div>
            <p className="text-xs text-muted-foreground">
              Largest: {formatCurrency(analytics.largestLossPnl)}
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
          <EquityCurveChart data={analytics.equityCurve} />
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <dt className="text-muted-foreground">Total Trades</dt>
                <dd className="font-medium">{analytics.totalTrades}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Open Positions</dt>
                <dd className="font-medium">{analytics.openTrades}</dd>
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
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Risk Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Max Drawdown</dt>
                <dd className="font-medium">
                  {formatNumber(analytics.maxDrawdownPercentage, { maximumFractionDigits: 2 })}%
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Profit Factor</dt>
                <dd className="font-medium">
                  {analytics.profitFactor !== null ? formatNumber(analytics.profitFactor, { maximumFractionDigits: 2 }) : "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Expectancy</dt>
                <dd className="font-medium">
                  {formatCurrency(analytics.expectancy)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Fees Paid</dt>
                <dd className="font-medium">
                  {formatCurrency(analytics.totalFees)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Unrealized P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-3xl font-bold mb-2",
              parseFloat(analytics.totalUnrealizedPnl) >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {formatCurrency(analytics.totalUnrealizedPnl)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {analytics.openTrades} open positions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentTradesTable />
        </CardContent>
      </Card>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg border bg-card"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg border bg-card" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
    </div>
  );
}
