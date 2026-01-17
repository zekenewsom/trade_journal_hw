import { inngest } from "../client";
import { db, eq } from "@trade-platform/db";
import { trades, transactions } from "@trade-platform/db/schema";

interface TransactionInput {
  ticker: string;
  action: "buy" | "sell";
  datetime: string;
  quantity: string;
  price: string;
  fees?: string;
  assetClass?: string;
  exchange?: string;
  notes?: string;
}

interface ImportCSVEventData {
  jobId: string;
  userId: string;
  orgId: string;
  transactions: TransactionInput[];
  skipIndices: number[];
}

/**
 * Background job for importing CSV transactions.
 * Used for large imports (100+ transactions) to avoid timeout issues.
 */
export const importCSVJob = inngest.createFunction(
  {
    id: "import-csv",
    name: "Import CSV Transactions",
    throttle: {
      limit: 5,
      period: "1m",
      key: "event.data.userId",
    },
  },
  { event: "import/csv.started" },
  async ({ event, step }) => {
    const { jobId, orgId, transactions: inputTransactions, skipIndices } = event.data as ImportCSVEventData;

    // Filter out skipped transactions
    const transactionsToImport = inputTransactions.filter(
      (_: unknown, index: number) => !skipIndices.includes(index)
    );

    if (transactionsToImport.length === 0) {
      return {
        jobId,
        status: "completed",
        imported: 0,
        skipped: inputTransactions.length,
        errors: [],
      };
    }

    // Step 1: Get unique tickers and fetch existing trades
    const existingTradeMap = await step.run("fetch-existing-trades", async () => {
      const uniqueTickers = [...new Set(transactionsToImport.map((t) => t.ticker.toUpperCase()))];

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

    // Step 2: Prepare batch arrays
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

      const errors: Array<{ index: number; error: string }> = [];
      const tradeMap = { ...existingTradeMap };

      for (let i = 0; i < transactionsToImport.length; i++) {
        const tx = transactionsToImport[i];

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
              assetClass: (tx.assetClass as "stock" | "cryptocurrency" | "forex" | "futures" | "options" | "prediction_market") || "stock",
              exchange: tx.exchange || "Unknown",
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
            index: i,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return { newTrades, newTransactions, errors };
    });

    // Step 3: Insert trades in batches
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

    // Step 4: Insert transactions in batches
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
      skipped: skipIndices.length,
      errors: batchData.errors,
      tradesCreated: batchData.newTrades.length,
    };
  }
);
