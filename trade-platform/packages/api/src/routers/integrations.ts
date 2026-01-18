import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  getDexClient,
  dexPlatforms,
  hyperliquidClient,
  polymarketClient,
  kalshiClient,
} from "@trade-platform/integrations/dex";
import { trades, transactions, users, organizations, orgMembers, importSources } from "@trade-platform/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { shouldCloseTrade } from "@trade-platform/core/pnl";
import { add, toDecimal, toString } from "@trade-platform/core/financial";
import type { TransactionData } from "@trade-platform/core";

/**
 * Helper to get or create user's organization
 */
async function getOrCreateUserOrg(db: any, externalUserId: string): Promise<string> {
  // First, find the user by external ID
  let user = await db
    .select()
    .from(users)
    .where(eq(users.externalId, externalUserId))
    .limit(1);

  // If user doesn't exist, create them
  if (user.length === 0) {
    const newUser = await db
      .insert(users)
      .values({
        externalId: externalUserId,
        email: `${externalUserId}@placeholder.com`,
      })
      .returning();
    user = newUser;
  }

  const userId = user[0].id;

  // Check if user has an org via org_members
  const membership = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1);

  if (membership.length > 0) {
    return membership[0].orgId;
  }

  // Check if user owns an org
  const ownedOrg = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.ownerId, userId))
    .limit(1);

  if (ownedOrg.length > 0) {
    return ownedOrg[0].id;
  }

  // Create a new org for the user
  const newOrg = await db
    .insert(organizations)
    .values({
      name: "My Trading Journal",
      ownerId: userId,
      plan: "free",
    })
    .returning();

  // Add user as owner member
  await db.insert(orgMembers).values({
    orgId: newOrg[0].id,
    userId: userId,
    role: "owner",
  });

  return newOrg[0].id;
}

export const integrationsRouter = createTRPCRouter({
  /**
   * Get list of available DEX platforms
   */
  getDexPlatforms: protectedProcedure.query(() => {
    return dexPlatforms;
  }),

  /**
   * Validate a wallet address for a specific platform
   */
  validateWalletAddress: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["hyperliquid", "polymarket", "kalshi"]),
        address: z.string(),
      })
    )
    .mutation(({ input }) => {
      const client = getDexClient(input.platform);
      return {
        valid: client.validateAddress(input.address),
      };
    }),

  /**
   * Fetch trades from a DEX for preview
   */
  fetchDexTrades: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["hyperliquid", "polymarket", "kalshi"]),
        walletAddress: z.string(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        limit: z.number().optional(),
        // Kalshi-specific
        apiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Set Kalshi credentials if provided
      if (input.platform === "kalshi" && input.apiKey) {
        kalshiClient.setCredentials(input.apiKey, input.walletAddress);
      }

      const client = getDexClient(input.platform);

      if (!client.validateAddress(input.walletAddress)) {
        throw new Error("Invalid wallet address");
      }

      const trades = await client.fetchTrades(input.walletAddress, {
        startTime: input.startTime ? new Date(input.startTime) : undefined,
        endTime: input.endTime ? new Date(input.endTime) : undefined,
        limit: input.limit,
      });

      return {
        trades: trades.map((t) => ({
          ticker: t.ticker,
          action: t.action,
          datetime: t.datetime.toISOString(),
          quantity: t.quantity,
          price: t.price,
          fees: t.fees,
          exchange: t.exchange,
          assetClass: t.assetClass,
          notes: t.notes,
        })),
        totalTrades: trades.length,
      };
    }),

  /**
   * Import trades from a DEX (optimized with batch operations)
   */
  importDexTrades: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["hyperliquid", "polymarket", "kalshi"]),
        walletAddress: z.string(),
        apiKey: z.string().optional(),
        startTime: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Set Kalshi credentials if provided
      if (input.platform === "kalshi" && input.apiKey) {
        kalshiClient.setCredentials(input.apiKey, input.walletAddress);
      }

      const client = getDexClient(input.platform);

      if (!client.validateAddress(input.walletAddress)) {
        throw new Error("Invalid wallet address");
      }

      const dexTrades = await client.fetchTrades(input.walletAddress, {
        startTime: input.startTime ? new Date(input.startTime) : undefined,
      });

      if (dexTrades.length === 0) {
        return {
          imported: 0,
          skipped: 0,
          errors: [],
          totalFetched: 0,
        };
      }

      // Get or create user's organization
      const orgId = await getOrCreateUserOrg(ctx.db, ctx.userId!);

      // Get unique tickers from the trades
      const uniqueTickers = [...new Set(dexTrades.map((t) => t.ticker.toUpperCase()))];

      // Batch fetch existing open trades for all tickers at once in this org
      const existingTrades = await ctx.db
        .select()
        .from(trades)
        .where(and(eq(trades.status, "open"), eq(trades.orgId, orgId)));

      // Create a map of ticker -> existing trade
      const existingTradeMap = new Map<string, string>();
      for (const trade of existingTrades) {
        if (uniqueTickers.includes(trade.instrumentTicker)) {
          existingTradeMap.set(trade.instrumentTicker, trade.id);
        }
      }

      // Prepare batch inserts
      const newTrades: Array<{
        id: string;
        orgId: string;
        instrumentTicker: string;
        assetClass: "stock" | "cryptocurrency" | "forex" | "futures" | "options" | "prediction_market";
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

      // Process trades and build batch arrays
      for (const tx of dexTrades) {
        try {
          const ticker = tx.ticker.toUpperCase();
          let tradeId = existingTradeMap.get(ticker);

          if (!tradeId) {
            // Need to create new trade
            tradeId = uuidv4();
            const tradeDirection = tx.action === "buy" ? "long" : "short";

            newTrades.push({
              id: tradeId,
              orgId,
              instrumentTicker: ticker,
              assetClass: tx.assetClass || "cryptocurrency",
              exchange: tx.exchange || input.platform,
              tradeDirection,
              status: "open",
              openDatetime: tx.datetime,
              feesTotal: tx.fees || "0",
            });

            // Add to map so subsequent txs for same ticker use this trade
            existingTradeMap.set(ticker, tradeId);
          }

          newTransactions.push({
            id: uuidv4(),
            tradeId,
            action: tx.action,
            quantity: tx.quantity,
            price: tx.price,
            datetime: tx.datetime,
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

      // Batch insert trades (in chunks of 100 to avoid query size limits)
      const BATCH_SIZE = 100;

      if (newTrades.length > 0) {
        for (let i = 0; i < newTrades.length; i += BATCH_SIZE) {
          const batch = newTrades.slice(i, i + BATCH_SIZE);
          await ctx.db.insert(trades).values(batch);
        }
      }

      // Batch insert transactions
      if (newTransactions.length > 0) {
        for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
          const batch = newTransactions.slice(i, i + BATCH_SIZE);
          await ctx.db.insert(transactions).values(batch);
        }
      }

      // Recalculate trade statuses after all transactions are inserted
      const affectedTradeIds = Array.from(new Set([
        ...Array.from(existingTradeMap.values()),
        ...newTrades.map(t => t.id),
      ]));

      for (const tradeId of affectedTradeIds) {
        const trade = await ctx.db.select().from(trades).where(eq(trades.id, tradeId)).limit(1);
        if (trade.length === 0) continue;
        const currentTrade = trade[0]!;

        const allTransactions = await ctx.db
          .select()
          .from(transactions)
          .where(eq(transactions.tradeId, tradeId));

        if (allTransactions.length === 0) continue;

        // Convert to TransactionData format
        const txData: TransactionData[] = allTransactions.map((tx) => ({
          id: tx.id,
          tradeId: tx.tradeId,
          action: tx.action,
          quantity: tx.quantity,
          price: tx.price,
          datetime: tx.datetime,
          fees: tx.fees || "0",
          notes: tx.notes,
        }));

        // Sort transactions by datetime
        txData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

        // Calculate total fees
        const totalFees = txData.reduce((sum, tx) => add(sum, tx.fees), toDecimal(0));

        // Check if trade should be closed
        const isClosed = shouldCloseTrade(txData, currentTrade.tradeDirection);

        // Get first and last transaction dates
        const firstTxDatetime = txData[0]?.datetime;
        const lastTxDatetime = txData[txData.length - 1]?.datetime;

        // Update trade status and dates
        await ctx.db
          .update(trades)
          .set({
            status: isClosed ? "closed" : "open",
            openDatetime: firstTxDatetime,
            closeDatetime: isClosed ? lastTxDatetime : null,
            feesTotal: toString(totalFees),
            updatedAt: new Date(),
          })
          .where(eq(trades.id, tradeId));
      }

      // Update lastSyncAt on the import source
      const existingConnection = await ctx.db
        .select()
        .from(importSources)
        .where(
          and(
            eq(importSources.orgId, orgId),
            eq(importSources.type, input.platform)
          )
        )
        .limit(1);

      if (existingConnection.length > 0) {
        await ctx.db
          .update(importSources)
          .set({
            lastSyncAt: new Date(),
            syncStatus: "idle",
          })
          .where(eq(importSources.id, existingConnection[0].id));
      }

      return {
        imported: newTransactions.length,
        skipped: 0,
        errors,
        totalFetched: dexTrades.length,
      };
    }),

  /**
   * Get Hyperliquid positions (for preview)
   */
  getHyperliquidPositions: protectedProcedure
    .input(z.object({ walletAddress: z.string() }))
    .query(async ({ input }) => {
      if (!hyperliquidClient.validateAddress(input.walletAddress)) {
        throw new Error("Invalid wallet address");
      }

      return hyperliquidClient.fetchPositions(input.walletAddress);
    }),

  /**
   * Save a wallet connection (allows multiple wallets per platform)
   */
  saveConnection: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["hyperliquid", "polymarket", "kalshi"]),
        walletAddress: z.string(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrCreateUserOrg(ctx.db, ctx.userId!);

      // Check if this specific wallet is already connected (allow multiple wallets per platform)
      const existing = await ctx.db
        .select()
        .from(importSources)
        .where(eq(importSources.orgId, orgId));

      const existingWallet = existing.find(
        (conn) =>
          conn.type === input.platform &&
          (conn.credentials as any)?.walletAddress === input.walletAddress
      );

      if (existingWallet) {
        // Update existing connection for this wallet
        await ctx.db
          .update(importSources)
          .set({
            name: input.name || `${input.platform} - ${input.walletAddress.slice(0, 8)}...`,
            updatedAt: new Date(),
          })
          .where(eq(importSources.id, existingWallet.id));

        return { id: existingWallet.id, updated: true };
      }

      // Create new connection (allows multiple per platform)
      const result = await ctx.db
        .insert(importSources)
        .values({
          orgId,
          type: input.platform,
          name: input.name || `${input.platform} - ${input.walletAddress.slice(0, 8)}...`,
          credentials: { walletAddress: input.walletAddress },
          syncStatus: "idle",
        })
        .returning();

      return { id: result[0].id, updated: false };
    }),

  /**
   * Get connected wallets for the user's organization
   */
  getConnections: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrCreateUserOrg(ctx.db, ctx.userId!);

    const connections = await ctx.db
      .select()
      .from(importSources)
      .where(eq(importSources.orgId, orgId));

    return connections.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      walletAddress: (c.credentials as any)?.walletAddress || "",
      lastSyncAt: c.lastSyncAt?.toISOString(),
      syncStatus: c.syncStatus,
      syncErrorMessage: c.syncErrorMessage,
      createdAt: c.createdAt.toISOString(),
    }));
  }),

  /**
   * Get trade count for a specific connection (for disconnect warning)
   */
  getConnectionTradeCount: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrCreateUserOrg(ctx.db, ctx.userId!);

      // Verify connection belongs to user's org
      const connection = await ctx.db
        .select()
        .from(importSources)
        .where(
          and(
            eq(importSources.id, input.connectionId),
            eq(importSources.orgId, orgId)
          )
        )
        .limit(1);

      if (connection.length === 0) {
        throw new Error("Connection not found");
      }

      // Count trades linked to this import source
      const tradeCount = await ctx.db
        .select({ count: trades.id })
        .from(trades)
        .where(eq(trades.importSourceId, input.connectionId));

      return {
        tradeCount: tradeCount.length,
        connectionName: connection[0].name,
      };
    }),

  /**
   * Disconnect a wallet and optionally remove associated trades
   */
  disconnect: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        removeTrades: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrCreateUserOrg(ctx.db, ctx.userId!);

      // Verify connection belongs to user's org
      const connection = await ctx.db
        .select()
        .from(importSources)
        .where(
          and(
            eq(importSources.id, input.connectionId),
            eq(importSources.orgId, orgId)
          )
        )
        .limit(1);

      if (connection.length === 0) {
        throw new Error("Connection not found");
      }

      let tradesRemoved = 0;

      if (input.removeTrades) {
        // Delete trades linked to this import source (transactions cascade)
        const deletedTrades = await ctx.db
          .delete(trades)
          .where(eq(trades.importSourceId, input.connectionId))
          .returning();

        tradesRemoved = deletedTrades.length;
      }

      // Delete the connection
      await ctx.db
        .delete(importSources)
        .where(eq(importSources.id, input.connectionId));

      return {
        success: true,
        tradesRemoved,
        connectionName: connection[0].name,
      };
    }),

  /**
   * Manually sync/refresh a connection to fetch new trades
   */
  syncConnection: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrCreateUserOrg(ctx.db, ctx.userId!);

      // Get the connection
      const connection = await ctx.db
        .select()
        .from(importSources)
        .where(
          and(
            eq(importSources.id, input.connectionId),
            eq(importSources.orgId, orgId)
          )
        )
        .limit(1);

      if (connection.length === 0) {
        throw new Error("Connection not found");
      }

      const conn = connection[0];
      const platform = conn.type as "hyperliquid" | "polymarket" | "kalshi";
      const walletAddress = (conn.credentials as any)?.walletAddress;

      if (!walletAddress) {
        throw new Error("No wallet address found for this connection");
      }

      // Update sync status to syncing
      await ctx.db
        .update(importSources)
        .set({ syncStatus: "syncing" })
        .where(eq(importSources.id, conn.id));

      try {
        const client = getDexClient(platform);

        // Fetch trades since last sync (or all if never synced)
        const dexTrades = await client.fetchTrades(walletAddress, {
          startTime: conn.lastSyncAt || undefined,
        });

        if (dexTrades.length === 0) {
          // Update sync time even if no new trades
          await ctx.db
            .update(importSources)
            .set({
              lastSyncAt: new Date(),
              syncStatus: "idle",
              syncErrorMessage: null,
            })
            .where(eq(importSources.id, conn.id));

          return {
            imported: 0,
            message: "No new trades found",
          };
        }

        // Get unique tickers from the trades
        const uniqueTickers = [...new Set(dexTrades.map((t) => t.ticker.toUpperCase()))];

        // Batch fetch existing open trades
        const existingTrades = await ctx.db
          .select()
          .from(trades)
          .where(and(eq(trades.status, "open"), eq(trades.orgId, orgId)));

        const existingTradeMap = new Map<string, string>();
        for (const trade of existingTrades) {
          if (uniqueTickers.includes(trade.instrumentTicker)) {
            existingTradeMap.set(trade.instrumentTicker, trade.id);
          }
        }

        // Prepare batch inserts
        const newTrades: Array<{
          id: string;
          orgId: string;
          instrumentTicker: string;
          assetClass: "stock" | "cryptocurrency" | "forex" | "futures" | "options" | "prediction_market";
          exchange: string;
          tradeDirection: "long" | "short";
          status: "open";
          openDatetime: Date;
          feesTotal: string;
          importSourceId: string;
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

        for (const tx of dexTrades) {
          const ticker = tx.ticker.toUpperCase();
          let tradeId = existingTradeMap.get(ticker);

          if (!tradeId) {
            tradeId = uuidv4();
            const tradeDirection = tx.action === "buy" ? "long" : "short";

            newTrades.push({
              id: tradeId,
              orgId,
              instrumentTicker: ticker,
              assetClass: tx.assetClass || "cryptocurrency",
              exchange: tx.exchange || platform,
              tradeDirection,
              status: "open",
              openDatetime: tx.datetime,
              feesTotal: tx.fees || "0",
              importSourceId: conn.id,
            });

            existingTradeMap.set(ticker, tradeId);
          }

          newTransactions.push({
            id: uuidv4(),
            tradeId,
            action: tx.action,
            quantity: tx.quantity,
            price: tx.price,
            datetime: tx.datetime,
            fees: tx.fees || "0",
            notes: tx.notes,
          });
        }

        // Batch insert
        const BATCH_SIZE = 100;

        if (newTrades.length > 0) {
          for (let i = 0; i < newTrades.length; i += BATCH_SIZE) {
            const batch = newTrades.slice(i, i + BATCH_SIZE);
            await ctx.db.insert(trades).values(batch);
          }
        }

        if (newTransactions.length > 0) {
          for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
            const batch = newTransactions.slice(i, i + BATCH_SIZE);
            await ctx.db.insert(transactions).values(batch);
          }
        }

        // Recalculate trade statuses after all transactions are inserted
        const affectedTradeIds = Array.from(new Set([
          ...Array.from(existingTradeMap.values()),
          ...newTrades.map(t => t.id),
        ]));

        for (const tradeId of affectedTradeIds) {
          const trade = await ctx.db.select().from(trades).where(eq(trades.id, tradeId)).limit(1);
          if (trade.length === 0) continue;
          const currentTrade = trade[0]!;

          const allTransactions = await ctx.db
            .select()
            .from(transactions)
            .where(eq(transactions.tradeId, tradeId));

          if (allTransactions.length === 0) continue;

          // Convert to TransactionData format
          const txData: TransactionData[] = allTransactions.map((tx) => ({
            id: tx.id,
            tradeId: tx.tradeId,
            action: tx.action,
            quantity: tx.quantity,
            price: tx.price,
            datetime: tx.datetime,
            fees: tx.fees || "0",
            notes: tx.notes,
          }));

          // Sort transactions by datetime
          txData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

          // Calculate total fees
          const totalFees = txData.reduce((sum, tx) => add(sum, tx.fees), toDecimal(0));

          // Check if trade should be closed
          const isClosed = shouldCloseTrade(txData, currentTrade.tradeDirection);

          // Get first and last transaction dates
          const firstTxDatetime = txData[0]?.datetime;
          const lastTxDatetime = txData[txData.length - 1]?.datetime;

          // Update trade status and dates
          await ctx.db
            .update(trades)
            .set({
              status: isClosed ? "closed" : "open",
              openDatetime: firstTxDatetime,
              closeDatetime: isClosed ? lastTxDatetime : null,
              feesTotal: toString(totalFees),
              updatedAt: new Date(),
            })
            .where(eq(trades.id, tradeId));
        }

        // Update connection with new sync time
        await ctx.db
          .update(importSources)
          .set({
            lastSyncAt: new Date(),
            syncStatus: "idle",
            syncErrorMessage: null,
          })
          .where(eq(importSources.id, conn.id));

        return {
          imported: newTransactions.length,
          newTrades: newTrades.length,
          message: `Imported ${newTransactions.length} new transactions`,
        };
      } catch (error) {
        // Update with error status
        await ctx.db
          .update(importSources)
          .set({
            syncStatus: "error",
            syncErrorMessage: error instanceof Error ? error.message : "Unknown error",
          })
          .where(eq(importSources.id, conn.id));

        throw error;
      }
    }),
});
