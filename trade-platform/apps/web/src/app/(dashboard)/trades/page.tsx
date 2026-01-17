"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api } from "@/trpc/react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortField = "openDatetime" | "ticker" | "realizedPnl" | "status";
type SortDirection = "asc" | "desc";

export default function TradesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assetClassFilter, setAssetClassFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("openDatetime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: trades, isLoading } = api.trades.list.useQuery();

  const filteredTrades = trades?.filter((trade) => {
    // Filter by status
    if (statusFilter !== "all" && trade.status !== statusFilter) {
      return false;
    }
    // Filter by asset class
    if (assetClassFilter !== "all" && trade.assetClass !== assetClassFilter) {
      return false;
    }
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        trade.instrumentTicker.toLowerCase().includes(searchLower) ||
        trade.exchange?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const sortedTrades = filteredTrades?.sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1;
    switch (sortField) {
      case "openDatetime":
        return (
          multiplier *
          (new Date(a.openDatetime || 0).getTime() -
            new Date(b.openDatetime || 0).getTime())
        );
      case "ticker":
        return multiplier * a.instrumentTicker.localeCompare(b.instrumentTicker);
      case "realizedPnl":
        return multiplier * ((a.realizedPnl || 0) - (b.realizedPnl || 0));
      case "status":
        return multiplier * a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trades</h1>
          <p className="text-muted-foreground">
            Manage and track all your trades
          </p>
        </div>
        <Link href="/trades/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Trade
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search trades..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assetClassFilter} onValueChange={setAssetClassFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Asset Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assets</SelectItem>
                  <SelectItem value="cryptocurrency">Crypto</SelectItem>
                  <SelectItem value="stock">Stocks</SelectItem>
                  <SelectItem value="options">Options</SelectItem>
                  <SelectItem value="futures">Futures</SelectItem>
                  <SelectItem value="forex">Forex</SelectItem>
                  <SelectItem value="prediction_market">Prediction</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : sortedTrades?.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <p className="text-lg font-medium">No trades found</p>
              <p className="text-sm text-muted-foreground">
                {search || statusFilter !== "all" || assetClassFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by logging your first trade"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => toggleSort("ticker")}
                    >
                      <div className="flex items-center gap-1">
                        Ticker
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => toggleSort("openDatetime")}
                    >
                      <div className="flex items-center gap-1">
                        Opened
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => toggleSort("status")}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead
                      className="cursor-pointer text-right"
                      onClick={() => toggleSort("realizedPnl")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        P&L
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTrades?.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>
                        <Link
                          href={`/trades/${trade.id}`}
                          className="font-medium hover:underline"
                        >
                          {trade.instrumentTicker}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {trade.exchange} · {trade.assetClass}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            trade.tradeDirection === "long"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {trade.tradeDirection === "long" ? "Long" : "Short"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {trade.openDatetime
                          ? formatDate(trade.openDatetime)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            trade.status === "open" ? "outline" : "secondary"
                          }
                        >
                          {trade.status === "open" ? "Open" : "Closed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {trade.currentOpenQuantity?.toFixed(4) || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {trade.averageOpenPrice
                          ? formatCurrency(trade.averageOpenPrice)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {trade.status === "closed" && trade.realizedPnl != null ? (
                          <span
                            className={cn(
                              "font-mono font-medium",
                              trade.realizedPnl > 0
                                ? "text-green-500"
                                : trade.realizedPnl < 0
                                ? "text-red-500"
                                : ""
                            )}
                          >
                            {formatCurrency(trade.realizedPnl)}
                          </span>
                        ) : trade.unrealizedPnl != null ? (
                          <span
                            className={cn(
                              "font-mono text-muted-foreground",
                              trade.unrealizedPnl > 0
                                ? "text-green-500/70"
                                : trade.unrealizedPnl < 0
                                ? "text-red-500/70"
                                : ""
                            )}
                          >
                            {formatCurrency(trade.unrealizedPnl)}
                            <span className="ml-1 text-xs">(unreal.)</span>
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
