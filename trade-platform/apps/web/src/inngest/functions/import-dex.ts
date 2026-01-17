import { inngest } from "../client";
import { db, eq } from "@trade-platform/db";
import { trades, transactions } from "@trade-platform/db/schema";
import {
  getDexClient,
  kalshiClient,
} from "@trade-platform/integrations/dex";

type DexPlatform = "hyperliquid" | "polymarket" | "kalshi";

interface ImportDexEventData {
  jobId: string;
  userId: string;
  orgId: string;
  platform: DexPlatform;
  walletAddress: string;
  apiKey?: string;
}

/**
 * Background job for importing DEX trades.
 * Handles the full fetch and import process for large DEX histories.
 */
export const importDexJob = inngest.createFunction(
  {
    id: "import-dex",
    name: "Import DEX Trades",
    throttle: {
      limit: 3,
      period: "1m",
      key: "event.data.userId",
    },
  },
  { event: "import/dex.started" },
  async ({ event, step }) => {
    const { jobId, orgId, platform, walletAddress, apiKey } = event.data as ImportDexEventData;

    // Step 1: Set up credentials if needed
    if (platform === "kalshi" && apiKey) {
      kalshiClient.setCredentials(apiKey, walletAddress);
    }

    // Step 2: Fetch trades from DEX
    const dexTrades = await step.run("fetch-dex-trades", async () => {
      const client = getDexClient(platform);

      if (!client.validateAddress(walletAddress)) {
        throw new Error("Invalid wallet address");
      }

      return await client.fetchTrades(walletAddress, {});
    });

    if (dexTrades.length === 0) {
      return {
        jobId,
        status: "completed",
        imported: 0,
        totalFetched: 0,
        errors: [],
      };
    }

    // Step 3: Get existing trades for tickers
    const existingTradeMap = await step.run("fetch-existing-trades", async () => {
      const uniqueTickers = [...new Set(dexTrades.map((t) => t.ticker.toUpperCase()))];

      const existingTrades = await db
        .select()
        .from(trades)
        .where(eq(trades.status, "open"));

      const tradeMap: Record<string, string> = {};
      for (const trade of existingTrades) {
        if (uniqueTickers.includes(trade.instrumentTicker)) {
          tradeMap[trade.instrumentTicker] = trade.id;
        }
      }
      return tradeMap;
    });

    // Step 4: Prepare batch data
    const batchData = await step.run("prepare-batches", async () => {
      const newTrades: Array<{
        id: string;
        orgId: string;
        instrumentTicker: string;
        assetClass: string;
        exchange: string;
        tradeDirection: "long" | "short";
        status: "open";
        openDatetime: Date;
        feesTotal: string;
      }> = [];

      const newTransactions: Array<{
        id: string;
        tradeId: string;
        action: "buy" | "sell";
        quantity: string;
        price: string;
        datetime: Date;
        fees: string;
        notes?: string;
      }> = [];

      const errors: Array<{ ticker: string; error: string }> = [];
      const tradeMap = { ...existingTradeMap };

      for (const tx of dexTrades) {
        try {
          const ticker = tx.ticker.toUpperCase();
          let tradeId = tradeMap[ticker];

          if (!tradeId) {
            tradeId = crypto.randomUUID();
            const tradeDirection = tx.action === "buy" ? "long" : "short";

            newTrades.push({
              id: tradeId,
              orgId,
              instrumentTicker: ticker,
              assetClass: (tx.assetClass as "stock" | "cryptocurrency" | "forex" | "futures" | "options" | "prediction_market") || "cryptocurrency",
              exchange: tx.exchange || platform,
              tradeDirection,
              status: "open",
              openDatetime: new Date(tx.datetime),
              feesTotal: tx.fees || "0",
            });

            tradeMap[ticker] = tradeId;
          }

          newTransactions.push({
            id: crypto.randomUUID(),
            tradeId,
            action: tx.action,
            quantity: tx.quantity,
            price: tx.price,
            datetime: new Date(tx.datetime),
            fees: tx.fees || "0",
            notes: tx.notes,
          });
        } catch (error) {
          errors.push({
            ticker: tx.ticker,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return { newTrades, newTransactions, errors };
    });

    // Step 5: Insert trades
    if (batchData.newTrades.length > 0) {
      await step.run("insert-trades", async () => {
        const BATCH_SIZE = 100;
        for (let i = 0; i < batchData.newTrades.length; i += BATCH_SIZE) {
          const batch = batchData.newTrades.slice(i, i + BATCH_SIZE);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.insert(trades).values(batch as any);
        }
      });
    }

    // Step 6: Insert transactions
    if (batchData.newTransactions.length > 0) {
      await step.run("insert-transactions", async () => {
        const BATCH_SIZE = 100;
        for (let i = 0; i < batchData.newTransactions.length; i += BATCH_SIZE) {
          const batch = batchData.newTransactions.slice(i, i + BATCH_SIZE);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.insert(transactions).values(batch as any);
        }
      });
    }

    return {
      jobId,
      status: "completed",
      imported: batchData.newTransactions.length,
      totalFetched: dexTrades.length,
      errors: batchData.errors,
      tradesCreated: batchData.newTrades.length,
    };
  }
);
