export * from "./types";
export * from "./hyperliquid";
export * from "./polymarket";
export * from "./kalshi";

import { hyperliquidClient, HyperliquidClient } from "./hyperliquid";
import { polymarketClient, PolymarketClient } from "./polymarket";
import { kalshiClient, KalshiClient } from "./kalshi";
import type { DexClient, DexPlatform } from "./types";

/**
 * Get a DEX client by platform
 */
export function getDexClient(platform: DexPlatform): DexClient {
  switch (platform) {
    case "hyperliquid":
      return hyperliquidClient;
    case "polymarket":
      return polymarketClient;
    case "kalshi":
      return kalshiClient;
    default:
      throw new Error(`Unknown DEX platform: ${platform}`);
  }
}

/**
 * Get all available DEX clients
 */
export function getAllDexClients(): DexClient[] {
  return [hyperliquidClient, polymarketClient, kalshiClient];
}

/**
 * Platform metadata for UI
 */
export const dexPlatforms: Array<{
  id: DexPlatform;
  name: string;
  description: string;
  requiresApiKey: boolean;
  website: string;
}> = [
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    description: "Decentralized perpetual exchange on Arbitrum",
    requiresApiKey: false,
    website: "https://hyperliquid.xyz",
  },
  {
    id: "polymarket",
    name: "Polymarket",
    description: "Decentralized prediction market on Polygon",
    requiresApiKey: false,
    website: "https://polymarket.com",
  },
  {
    id: "kalshi",
    name: "Kalshi",
    description: "Regulated US prediction market exchange",
    requiresApiKey: true,
    website: "https://kalshi.com",
  },
];
