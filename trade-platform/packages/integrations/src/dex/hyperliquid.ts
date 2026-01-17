import type { DexClient } from "./types";
import type { ParsedTransaction } from "../types";

const HYPERLIQUID_API_URL = "https://api.hyperliquid.xyz";

/**
 * Hyperliquid API response types
 */
interface HyperliquidFill {
  coin: string;
  px: string; // price
  sz: string; // size/quantity
  side: "A" | "B"; // A = Ask/Sell, B = Bid/Buy
  time: number; // Unix timestamp in ms
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
}

interface HyperliquidUserFillsResponse {
  fills: HyperliquidFill[];
}

/**
 * Hyperliquid DEX client
 *
 * Fetches trade history from Hyperliquid's public API.
 * No authentication required for read-only access to public fill data.
 */
export class HyperliquidClient implements DexClient {
  platform = "hyperliquid" as const;

  /**
   * Validate an Ethereum address
   */
  validateAddress(address: string): boolean {
    // Basic Ethereum address validation
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
      // Fetch user fills (completed trades)
      const response = await fetch(`${HYPERLIQUID_API_URL}/info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "userFills",
          user: walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`Hyperliquid API error: ${response.status}`);
      }

      const fills: HyperliquidFill[] = await response.json();

      // Filter by time range if specified
      let filteredFills = fills;

      if (options?.startTime) {
        const startMs = options.startTime.getTime();
        filteredFills = filteredFills.filter((f) => f.time >= startMs);
      }

      if (options?.endTime) {
        const endMs = options.endTime.getTime();
        filteredFills = filteredFills.filter((f) => f.time <= endMs);
      }

      // Apply limit
      if (options?.limit) {
        filteredFills = filteredFills.slice(0, options.limit);
      }

      // Convert to ParsedTransaction format
      for (const fill of filteredFills) {
        trades.push({
          ticker: fill.coin,
          action: fill.side === "B" ? "buy" : "sell",
          datetime: new Date(fill.time),
          quantity: fill.sz,
          price: fill.px,
          fees: fill.fee,
          exchange: "Hyperliquid",
          assetClass: "cryptocurrency",
          notes: `Order ID: ${fill.oid}, Hash: ${fill.hash.slice(0, 10)}...`,
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch Hyperliquid trades: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    return trades;
  }

  /**
   * Fetch current positions for a wallet
   */
  async fetchPositions(walletAddress: string): Promise<{
    coin: string;
    size: string;
    entryPrice: string;
    unrealizedPnl: string;
  }[]> {
    if (!this.validateAddress(walletAddress)) {
      throw new Error("Invalid Ethereum wallet address");
    }

    const response = await fetch(`${HYPERLIQUID_API_URL}/info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: walletAddress,
      }),
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.status}`);
    }

    const data = await response.json();

    return data.assetPositions?.map((pos: any) => ({
      coin: pos.position.coin,
      size: pos.position.szi,
      entryPrice: pos.position.entryPx,
      unrealizedPnl: pos.position.unrealizedPnl,
    })) || [];
  }
}

export const hyperliquidClient = new HyperliquidClient();
