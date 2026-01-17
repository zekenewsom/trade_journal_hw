import { api } from "@/trpc/server";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";

export async function RecentTradesTable() {
  const trades = await api.trades.list();

  if (!trades || trades.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        No trades yet. Add your first trade to get started.
      </div>
    );
  }

  // Get the 5 most recent trades
  const recentTrades = trades.slice(0, 5);

  return (
    <div className="space-y-4">
      {recentTrades.map((trade) => (
        <Link
          key={trade.id}
          href={`/trades/${trade.id}`}
          className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{trade.instrumentTicker}</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  trade.tradeDirection === "long"
                    ? "bg-green-500/10 text-green-500"
                    : "bg-red-500/10 text-red-500"
                )}
              >
                {trade.tradeDirection.toUpperCase()}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs",
                  trade.status === "open"
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {trade.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(trade.openDatetime)}
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "font-medium",
                trade.realizedPnl
                  ? Number(trade.realizedPnl) >= 0
                    ? "text-green-500"
                    : "text-red-500"
                  : "text-muted-foreground"
              )}
            >
              {trade.realizedPnl
                ? formatCurrency(Number(trade.realizedPnl))
                : trade.unrealizedPnl
                ? formatCurrency(Number(trade.unrealizedPnl))
                : "-"}
            </p>
            <p className="text-xs text-muted-foreground">
              {trade.outcome || (trade.status === "open" ? "Unrealized" : "")}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
