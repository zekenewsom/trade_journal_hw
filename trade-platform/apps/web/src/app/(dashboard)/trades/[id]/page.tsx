import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDuration, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TradeReviewForm } from "@/components/trade/trade-review-form";

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

  // Calculate total bought and sold quantities with average prices
  const totals = trade.transactions?.reduce(
    (acc, tx) => {
      const qty = Number(tx.quantity);
      const price = Number(tx.price);
      const value = qty * price;

      if (tx.action === "buy") {
        acc.boughtQty += qty;
        acc.boughtValue += value;
      } else {
        acc.soldQty += qty;
        acc.soldValue += value;
      }
      return acc;
    },
    { boughtQty: 0, boughtValue: 0, soldQty: 0, soldValue: 0 }
  ) || { boughtQty: 0, boughtValue: 0, soldQty: 0, soldValue: 0 };

  const avgBuyPrice = totals.boughtQty > 0 ? totals.boughtValue / totals.boughtQty : null;
  const avgSellPrice = totals.soldQty > 0 ? totals.soldValue / totals.soldQty : null;

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
                <dt className="text-muted-foreground">Total Bought</dt>
                <dd className="font-mono font-medium text-green-500">
                  {totals.boughtQty.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Avg Buy Price</dt>
                <dd className="font-mono font-medium text-green-500">
                  {avgBuyPrice !== null ? formatCurrency(avgBuyPrice) : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Sold</dt>
                <dd className="font-mono font-medium text-red-500">
                  {totals.soldQty.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Avg Sell Price</dt>
                <dd className="font-mono font-medium text-red-500">
                  {avgSellPrice !== null ? formatCurrency(avgSellPrice) : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Open Quantity</dt>
                <dd className="font-mono font-medium">
                  {trade.pnl?.openQuantity || "0"}
                </dd>
              </div>
              {trade.status === "open" && trade.pnl?.averageOpenPrice && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Avg Open Price</dt>
                  <dd className="font-mono font-medium">
                    {formatCurrency(Number(trade.pnl.averageOpenPrice))}
                  </dd>
                </div>
              )}
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

      {/* Trade Context Card */}
      {(trade.marketConditions || trade.setupDescription || trade.reasoning) && (
        <Card>
          <CardHeader>
            <CardTitle>Trade Context</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              {trade.marketConditions && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-1">
                    Market Conditions
                  </dt>
                  <dd className="text-sm">{trade.marketConditions}</dd>
                </div>
              )}
              {trade.setupDescription && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-1">
                    Setup Description
                  </dt>
                  <dd className="text-sm">{trade.setupDescription}</dd>
                </div>
              )}
              {trade.reasoning && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-1">
                    Initial Thesis
                  </dt>
                  <dd className="text-sm">{trade.reasoning}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Notes & Lessons Card */}
      {(trade.lessonsLearned || (trade.emotions && trade.emotions.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>Notes & Lessons</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              {trade.emotions && trade.emotions.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-2">
                    Emotions
                  </dt>
                  <dd className="flex flex-wrap gap-2">
                    {trade.emotions.map((emotion) => (
                      <Badge key={emotion.id} variant="outline">
                        {emotion.name}
                      </Badge>
                    ))}
                  </dd>
                </div>
              )}
              {trade.lessonsLearned && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-1">
                    Lessons Learned
                  </dt>
                  <dd className="text-sm">{trade.lessonsLearned}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Trade Metrics Card */}
      {(trade.pnl?.durationMs || trade.rMultipleInitialRisk || trade.rMultipleActual) && (
        <Card>
          <CardHeader>
            <CardTitle>Trade Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {trade.pnl?.durationMs && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="font-medium">
                    {formatDuration(trade.pnl.durationMs)}
                  </dd>
                </div>
              )}
              {trade.rMultipleInitialRisk && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Initial Risk (R)</dt>
                  <dd className="font-mono font-medium">
                    {formatCurrency(Number(trade.rMultipleInitialRisk))}
                  </dd>
                </div>
              )}
              {trade.rMultipleActual && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Actual R-Multiple</dt>
                  <dd
                    className={cn(
                      "font-mono font-medium",
                      Number(trade.rMultipleActual) >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    )}
                  >
                    {Number(trade.rMultipleActual).toFixed(2)}R
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Advanced Metrics Card */}
      {(trade.returnOnAllocatedCapital || trade.maxCapitalUsed || trade.implementationShortfall) && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {trade.maxCapitalUsed && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Max Capital Used</dt>
                  <dd className="font-mono font-medium">
                    {formatCurrency(Number(trade.maxCapitalUsed))}
                  </dd>
                </div>
              )}
              {trade.returnOnAllocatedCapital && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Return on Allocated Capital</dt>
                  <dd
                    className={cn(
                      "font-mono font-medium",
                      Number(trade.returnOnAllocatedCapital) >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    )}
                  >
                    {formatPercent(Number(trade.returnOnAllocatedCapital))}
                  </dd>
                </div>
              )}
              {trade.decisionPrice && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Decision Price</dt>
                  <dd className="font-mono font-medium">
                    {formatCurrency(Number(trade.decisionPrice))}
                  </dd>
                </div>
              )}
              {trade.implementationShortfall && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Implementation Shortfall</dt>
                  <dd
                    className={cn(
                      "font-mono font-medium",
                      Number(trade.implementationShortfall) <= 0
                        ? "text-green-500"
                        : "text-red-500"
                    )}
                  >
                    {formatPercent(Number(trade.implementationShortfall))}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Key Lessons Card (from review) */}
      {(trade.keyLesson1 || trade.keyLesson2 || trade.keyLesson3) && (
        <Card>
          <CardHeader>
            <CardTitle>Key Lessons</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {trade.keyLesson1 && (
                <li className="flex gap-2">
                  <span className="text-muted-foreground">1.</span>
                  <span className="text-sm">{trade.keyLesson1}</span>
                </li>
              )}
              {trade.keyLesson2 && (
                <li className="flex gap-2">
                  <span className="text-muted-foreground">2.</span>
                  <span className="text-sm">{trade.keyLesson2}</span>
                </li>
              )}
              {trade.keyLesson3 && (
                <li className="flex gap-2">
                  <span className="text-muted-foreground">3.</span>
                  <span className="text-sm">{trade.keyLesson3}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Trade Review Summary (read-only display if review exists) */}
      {(trade.thesisValidation || trade.planAdherence || trade.overallRating) && (
        <Card>
          <CardHeader>
            <CardTitle>Trade Review Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {trade.overallRating && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Overall Rating</dt>
                  <dd className="font-medium">{trade.overallRating}/5</dd>
                </div>
              )}
              {trade.thesisValidation && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Thesis Validation</dt>
                  <dd>
                    <Badge
                      variant={
                        trade.thesisValidation === "correct"
                          ? "success"
                          : trade.thesisValidation === "incorrect"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {trade.thesisValidation === "correct"
                        ? "Correct"
                        : trade.thesisValidation === "incorrect"
                        ? "Incorrect"
                        : "Partial"}
                    </Badge>
                  </dd>
                </div>
              )}
              {trade.planAdherence && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Plan Adherence</dt>
                  <dd>
                    <Badge
                      variant={
                        trade.planAdherence === "high"
                          ? "success"
                          : trade.planAdherence === "low"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {trade.planAdherence.charAt(0).toUpperCase() + trade.planAdherence.slice(1)}
                    </Badge>
                  </dd>
                </div>
              )}
              {trade.outcomeOverride && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Outcome Override</dt>
                  <dd>
                    <Badge variant="outline">
                      {trade.outcomeOverride === "win"
                        ? "Win"
                        : trade.outcomeOverride === "loss"
                        ? "Loss"
                        : "Break Even"}
                    </Badge>
                  </dd>
                </div>
              )}
              {trade.unforeseenEvents && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-1">
                    Unforeseen Events
                  </dt>
                  <dd className="text-sm">{trade.unforeseenEvents}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Trade Review Form (editable) */}
      <TradeReviewForm
        tradeId={trade.id}
        initialData={{
          thesisValidation: trade.thesisValidation,
          planAdherence: trade.planAdherence,
          planAdherenceNotes: trade.planAdherenceNotes,
          unforeseenEvents: trade.unforeseenEvents,
          overallRating: trade.overallRating,
          outcomeOverride: trade.outcomeOverride,
          keyLesson1: trade.keyLesson1,
          keyLesson2: trade.keyLesson2,
          keyLesson3: trade.keyLesson3,
          decisionPrice: trade.decisionPrice,
          systemOutcome: trade.pnl?.outcome,
        }}
      />

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
