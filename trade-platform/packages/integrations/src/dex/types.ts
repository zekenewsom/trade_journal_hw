import type { ParsedTransaction } from "../types";

/**
 * DEX connection configuration
 */
export interface DexConnection {
  id: string;
  platform: DexPlatform;
  walletAddress: string;
  label?: string;
  createdAt: Date;
  lastSyncAt?: Date;
  syncStatus: "idle" | "syncing" | "error";
  syncError?: string;
}

/**
 * Supported DEX platforms
 */
export type DexPlatform = "hyperliquid" | "polymarket" | "kalshi";

/**
 * DEX sync result
 */
export interface DexSyncResult {
  success: boolean;
  transactions: ParsedTransaction[];
  newTransactions: number;
  duplicateTransactions: number;
  errors: string[];
  lastTradeAt?: Date;
}

/**
 * Generic DEX client interface
 */
export interface DexClient {
  platform: DexPlatform;

  /**
   * Validate a wallet address for this platform
   */
  validateAddress(address: string): boolean;

  /**
   * Fetch trade history for a wallet
   */
  fetchTrades(
    walletAddress: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    }
  ): Promise<ParsedTransaction[]>;
}
