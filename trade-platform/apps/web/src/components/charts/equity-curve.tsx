"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

interface EquityCurveDataPoint {
  date: number | string;
  equity: number | string;
}

interface EquityCurveChartProps {
  data: EquityCurveDataPoint[] | null | undefined;
}

export function EquityCurveChart({ data }: EquityCurveChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No trade data available yet
      </div>
    );
  }

  // Transform data for the chart
  const chartData = data.map((point) => ({
    date: typeof point.date === "number"
      ? new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : point.date,
    equity: typeof point.equity === "string" ? parseFloat(point.equity) : point.equity,
    rawDate: point.date,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatCurrency(value, { showSign: false })}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground">
                      {payload[0].payload.date}
                    </span>
                    <span className="font-bold">
                      {formatCurrency(payload[0].value as number)}
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#equityGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
