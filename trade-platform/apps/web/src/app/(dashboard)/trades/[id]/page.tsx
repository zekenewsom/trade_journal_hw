import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TradePageProps {
  params: Promise<{ id: string }>;
}

export default async function TradePage({ params }: TradePageProps) {
  const { id } = await params;

  const trade = await api.trades.getById({ id });

  if (!trade) {
    notFound();
  }

  const pnlValue = trade.pnl?.realizedNetPnl
    ? Number(trade.pnl.realizedNetPnl)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/trades">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {trade.instrumentTicker}
            </h1>
            <Badge
              variant={trade.tradeDirection === "long" ? "default" : "secondary"}
            >
              {trade.tradeDirection === "long" ? "Long" : "Short"}
            </Badge>
            <Badge variant={trade.status === "open" ? "outline" : "secondary"}>
              {trade.status === "open" ? "Open" : "Closed"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {trade.exchange} · {trade.assetClass}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Trade Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Opened</dt>
                <dd className="font-medium">
                  {trade.openDatetime ? formatDate(trade.openDatetime) : "-"}
                </dd>
              </div>
              {trade.closeDatetime && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Closed</dt>
                  <dd className="font-medium">
                    {formatDate(trade.closeDatetime)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Open Quantity</dt>
                <dd className="font-mono font-medium">
                  {trade.pnl?.openQuantity || "0"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Avg Open Price</dt>
                <dd className="font-mono font-medium">
                  {trade.pnl?.averageOpenPrice
                    ? formatCurrency(Number(trade.pnl.averageOpenPrice))
                    : "-"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Realized P&L</dt>
                <dd
                  className={cn(
                    "font-mono font-medium",
                    pnlValue !== null && pnlValue >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  )}
                >
                  {pnlValue !== null ? formatCurrency(pnlValue) : "-"}
                </dd>
              </div>
              {trade.pnl?.unrealizedGrossPnl && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Unrealized P&L</dt>
                  <dd className="font-mono font-medium text-muted-foreground">
                    {formatCurrency(Number(trade.pnl.unrealizedGrossPnl))}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Fees</dt>
                <dd className="font-mono font-medium">
                  {formatCurrency(Number(trade.feesTotal) || 0)}
                </dd>
              </div>
              {trade.pnl?.outcome && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Outcome</dt>
                  <dd>
                    <Badge
                      variant={
                        trade.pnl.outcome === "win"
                          ? "success"
                          : trade.pnl.outcome === "loss"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {trade.pnl.outcome === "win"
                        ? "Win"
                        : trade.pnl.outcome === "loss"
                        ? "Loss"
                        : "Break Even"}
                    </Badge>
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {trade.transactions && trade.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trade.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <Badge variant={tx.action === "buy" ? "default" : "secondary"}>
                      {tx.action === "buy" ? "Buy" : "Sell"}
                    </Badge>
                    <span className="ml-3 font-mono">{tx.quantity}</span>
                    <span className="ml-1 text-muted-foreground">@</span>
                    <span className="ml-1 font-mono">
                      {formatCurrency(Number(tx.price))}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {formatDate(tx.datetime)}
                    </div>
                    {tx.fees && Number(tx.fees) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Fee: {formatCurrency(Number(tx.fees))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
