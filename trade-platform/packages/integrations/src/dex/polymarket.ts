import type { DexClient } from "./types";
import type { ParsedTransaction } from "../types";

const POLYMARKET_API_URL = "https://clob.polymarket.com";
const POLYMARKET_GAMMA_API_URL = "https://gamma-api.polymarket.com";

/**
 * Polymarket API response types
 */
interface PolymarketTrade {
  id: string;
  taker_order_id: string;
  market: string;
  asset_id: string;
  side: "BUY" | "SELL";
  size: string;
  price: string;
  status: string;
  match_time: string;
  fee_rate_bps: string;
  outcome: string;
  owner: string;
  transaction_hash?: string;
}

interface PolymarketMarket {
  condition_id: string;
  question_id: string;
  question: string;
  description: string;
  end_date_iso: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
  }>;
}

/**
 * Polymarket prediction market client
 *
 * Fetches trade history from Polymarket's CLOB API.
 */
export class PolymarketClient implements DexClient {
  platform = "polymarket" as const;

  /**
   * Validate an Ethereum address
   */
  validateAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Fetch trade history for a wallet address
   */
  async fetchTrades(
    walletAddress: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    }
  ): Promise<ParsedTransaction[]> {
    if (!this.validateAddress(walletAddress)) {
      throw new Error("Invalid Ethereum wallet address");
    }

    const trades: ParsedTransaction[] = [];

    try {
      // Build query parameters
      const params = new URLSearchParams({
        maker_address: walletAddress,
      });

      if (options?.limit) {
        params.set("limit", options.limit.toString());
      }

      // Fetch user trades
      const response = await fetch(
        `${POLYMARKET_API_URL}/trades?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const data: PolymarketTrade[] = await response.json();

      // Filter by time range if specified
      let filteredTrades = data;

      if (options?.startTime) {
        filteredTrades = filteredTrades.filter(
          (t) => new Date(t.match_time) >= options.startTime!
        );
      }

      if (options?.endTime) {
        filteredTrades = filteredTrades.filter(
          (t) => new Date(t.match_time) <= options.endTime!
        );
      }

      // Fetch market info for each unique market
      const marketIds = [...new Set(filteredTrades.map((t) => t.market))];
      const marketInfo = new Map<string, PolymarketMarket>();

      for (const marketId of marketIds) {
        try {
          const marketResponse = await fetch(
            `${POLYMARKET_GAMMA_API_URL}/markets/${marketId}`
          );
          if (marketResponse.ok) {
            const market: PolymarketMarket = await marketResponse.json();
            marketInfo.set(marketId, market);
          }
        } catch {
          // Continue without market info
        }
      }

      // Convert to ParsedTransaction format
      for (const trade of filteredTrades) {
        const market = marketInfo.get(trade.market);
        const ticker = market
          ? `PM-${market.question.slice(0, 20).replace(/\s+/g, "-").toUpperCase()}`
          : `PM-${trade.market.slice(0, 8)}`;

        // Calculate fees from fee rate
        const tradeValue =
          parseFloat(trade.size) * parseFloat(trade.price);
        const feeRate = parseFloat(trade.fee_rate_bps) / 10000;
        const fees = (tradeValue * feeRate).toString();

        trades.push({
          ticker,
          action: trade.side === "BUY" ? "buy" : "sell",
          datetime: new Date(trade.match_time),
          quantity: trade.size,
          price: trade.price,
          fees,
          exchange: "Polymarket",
          assetClass: "prediction_market",
          notes: market
            ? `${market.question} - Outcome: ${trade.outcome}`
            : `Market: ${trade.market}, Outcome: ${trade.outcome}`,
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch Polymarket trades: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    return trades;
  }
}

export const polymarketClient = new PolymarketClient();
