import { Inngest } from "inngest";

// Create an Inngest client for the trade platform
export const inngest = new Inngest({
  id: "trade-platform",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Event types for type safety
export type ImportEvents = {
  "import/csv.started": {
    data: {
      jobId: string;
      userId: string;
      transactionCount: number;
      transactions: Array<{
        ticker: string;
        action: "buy" | "sell";
        datetime: string;
        quantity: string;
        price: string;
        fees?: string;
        assetClass?: string;
        exchange?: string;
        notes?: string;
      }>;
      skipIndices: number[];
    };
  };
  "import/dex.started": {
    data: {
      jobId: string;
      userId: string;
      platform: "hyperliquid" | "polymarket" | "kalshi";
      walletAddress: string;
      apiKey?: string;
    };
  };
};
