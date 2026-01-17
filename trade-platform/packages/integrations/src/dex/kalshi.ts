import type { DexClient } from "./types";
import type { ParsedTransaction } from "../types";

const KALSHI_API_URL = "https://trading-api.kalshi.com/trade-api/v2";

/**
 * Kalshi API response types
 */
interface KalshiFill {
  action: "buy" | "sell";
  count: number;
  created_time: string;
  is_taker: boolean;
  no_price: number;
  order_id: string;
  side: "yes" | "no";
  ticker: string;
  trade_id: string;
  yes_price: number;
}

interface KalshiMarket {
  ticker: string;
  title: string;
  category: string;
  close_time: string;
  status: string;
}

/**
 * Kalshi prediction market client
 *
 * Kalshi requires API key authentication for accessing trade history.
 * This is a regulated US exchange.
 */
export class KalshiClient implements DexClient {
  platform = "kalshi" as const;
  private apiKey: string = "";
  private memberId: string = "";

  /**
   * Set API credentials
   */
  setCredentials(apiKey: string, memberId: string) {
    this.apiKey = apiKey;
    this.memberId = memberId;
  }

  /**
   * Validate Kalshi member ID (email or ID)
   */
  validateAddress(memberId: string): boolean {
    // Kalshi uses email or member ID
    return memberId.length > 0;
  }

  /**
   * Make authenticated request to Kalshi API
   */
  private async makeRequest<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error("Kalshi API key not set. Call setCredentials first.");
    }

    const response = await fetch(`${KALSHI_API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kalshi API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Fetch trade history (fills) for the authenticated user
   */
  async fetchTrades(
    _walletAddress: string, // Not used for Kalshi, uses API auth
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    }
  ): Promise<ParsedTransaction[]> {
    const trades: ParsedTransaction[] = [];

    try {
      // Build query parameters
      const params = new URLSearchParams();

      if (options?.startTime) {
        params.set("min_ts", Math.floor(options.startTime.getTime() / 1000).toString());
      }

      if (options?.endTime) {
        params.set("max_ts", Math.floor(options.endTime.getTime() / 1000).toString());
      }

      if (options?.limit) {
        params.set("limit", options.limit.toString());
      }

      // Fetch fills (trades)
      const fills = await this.makeRequest<{ fills: KalshiFill[] }>(
        `/portfolio/fills?${params.toString()}`
      );

      // Fetch market info for context
      const tickers = [...new Set(fills.fills.map((f) => f.ticker))];
      const marketInfo = new Map<string, KalshiMarket>();

      for (const ticker of tickers) {
        try {
          const market = await this.makeRequest<{ market: KalshiMarket }>(
            `/markets/${ticker}`
          );
          marketInfo.set(ticker, market.market);
        } catch {
          // Continue without market info
        }
      }

      // Convert to ParsedTransaction format
      for (const fill of fills.fills) {
        const market = marketInfo.get(fill.ticker);

        // Kalshi prices are in cents (0-100), convert to decimal
        const price = fill.side === "yes"
          ? (fill.yes_price / 100).toFixed(2)
          : (fill.no_price / 100).toFixed(2);

        trades.push({
          ticker: fill.ticker,
          action: fill.action,
          datetime: new Date(fill.created_time),
          quantity: fill.count.toString(),
          price,
          fees: "0", // Kalshi fees are built into the spread
          exchange: "Kalshi",
          assetClass: "prediction_market",
          notes: market
            ? `${market.title} - ${fill.side.toUpperCase()}`
            : `${fill.side.toUpperCase()}`,
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch Kalshi trades: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    return trades;
  }

  /**
   * Get current positions
   */
  async fetchPositions(): Promise<
    Array<{
      ticker: string;
      side: "yes" | "no";
      quantity: number;
      averagePrice: number;
    }>
  > {
    const response = await this.makeRequest<{
      market_positions: Array<{
        ticker: string;
        position: number;
        market_exposure: number;
        realized_pnl: number;
        total_traded: number;
      }>;
    }>("/portfolio/positions");

    return response.market_positions
      .filter((p) => p.position !== 0)
      .map((p) => ({
        ticker: p.ticker,
        side: p.position > 0 ? ("yes" as const) : ("no" as const),
        quantity: Math.abs(p.position),
        averagePrice: p.market_exposure / Math.abs(p.position),
      }));
  }
}

export const kalshiClient = new KalshiClient();
