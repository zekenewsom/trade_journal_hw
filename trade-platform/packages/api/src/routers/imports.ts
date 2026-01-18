import { z } from "zod";
import Papa from "papaparse";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { trades, transactions, importJobs, users, organizations, orgMembers } from "@trade-platform/db/schema";
import { parseCSV, getAllProviders, detectProvider } from "@trade-platform/integrations/parsers";
import type { ParsedTransaction, ImportProvider } from "@trade-platform/integrations";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
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
        email: `${externalUserId}@placeholder.com`, // Placeholder email
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

// Threshold for using background jobs (transactions count)
const BACKGROUND_JOB_THRESHOLD = 100;

const columnMappingSchema = z.object({
  ticker: z.string().optional(),
  action: z.string().optional(),
  datetime: z.string().optional(),
  quantity: z.string().optional(),
  price: z.string().optional(),
  fees: z.string().optional(),
  assetClass: z.string().optional(),
  exchange: z.string().optional(),
  notes: z.string().optional(),
});

export const importsRouter = createTRPCRouter({
  /**
   * Get list of available import providers.
   */
  getProviders: protectedProcedure.query(() => {
    const providers = getAllProviders();
    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      supportedFileTypes: p.supportedFileTypes,
    }));
  }),

  /**
   * Get CSV headers and sample data for column mapping.
   */
  getCSVHeaders: protectedProcedure
    .input(z.object({ content: z.string() }))
    .mutation(({ input }) => {
      const parseResult = Papa.parse<Record<string, string>>(input.content, {
        header: true,
        skipEmptyLines: true,
        preview: 5, // Only parse first 5 rows for preview
        transformHeader: (header) => header.trim(),
      });

      const headers = parseResult.meta.fields || [];
      const sampleData = parseResult.data;

      // Try to detect provider
      const detected = detectProvider(headers, sampleData[0]);

      return {
        headers,
        sampleData,
        detectedProvider: detected?.id || null,
        suggestedMapping: detected?.columnMapping || null,
      };
    }),

  /**
   * Parse a CSV file and return preview data.
   */
  parseCSV: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        provider: z.string().optional(),
        columnMapping: columnMappingSchema.optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = parseCSV(input.content, {
        provider: input.provider,
        columnMapping: input.columnMapping,
      });

      return {
        success: result.success,
        provider: result.provider,
        detectedFormat: result.detectedFormat,
        totalRows: result.totalRows,
        successfulRows: result.successfulRows,
        failedRows: result.failedRows,
        transactions: result.transactions.map((tx) => ({
          ticker: tx.ticker,
          action: tx.action,
          datetime: tx.datetime.toISOString(),
          quantity: tx.quantity,
          price: tx.price,
          fees: tx.fees,
          assetClass: tx.assetClass,
          exchange: tx.exchange,
          notes: tx.notes,
          rowNumber: tx.rowNumber,
        })),
        errors: result.errors,
        warnings: result.warnings,
      };
    }),

  /**
   * Check for duplicate transactions (optimized with batch query).
   */
  checkDuplicates: protectedProcedure
    .input(
      z.object({
        transactions: z.array(
          z.object({
            ticker: z.string(),
            datetime: z.string(),
            quantity: z.string(),
            price: z.string(),
            action: z.enum(["buy", "sell"]),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.transactions.length === 0) {
        return { duplicates: [] };
      }

      // Get unique tickers from input
      const uniqueTickers = [...new Set(input.transactions.map((t) => t.ticker.toUpperCase()))];

      // Batch fetch all existing transactions for these tickers
      let existingTransactions: Array<{
        tradeId: string;
        ticker: string;
        action: string;
        quantity: string;
        price: string;
      }> = [];

      try {
        existingTransactions = await ctx.db
          .select({
            tradeId: trades.id,
            ticker: trades.instrumentTicker,
            action: transactions.action,
            quantity: transactions.quantity,
            price: transactions.price,
          })
          .from(transactions)
          .innerJoin(trades, eq(transactions.tradeId, trades.id))
          .where(inArray(trades.instrumentTicker, uniqueTickers));
      } catch (error) {
        // If query fails, just return no duplicates and let import proceed
        console.error("Error checking duplicates:", error);
        return { duplicates: [] };
      }

      // Build a lookup map for fast duplicate checking
      // Key format: "TICKER|action|quantity|price"
      const existingMap = new Map<string, string>();
      for (const tx of existingTransactions) {
        const key = `${tx.ticker}|${tx.action}|${tx.quantity}|${tx.price}`;
        existingMap.set(key, tx.tradeId);
      }

      // Check each input transaction against the map
      const duplicates: Array<{
        index: number;
        existingTradeId: string;
        matchType: "exact" | "fuzzy";
      }> = [];

      for (let i = 0; i < input.transactions.length; i++) {
        const tx = input.transactions[i];
        const key = `${tx.ticker.toUpperCase()}|${tx.action}|${tx.quantity}|${tx.price}`;
        const existingTradeId = existingMap.get(key);

        if (existingTradeId) {
          duplicates.push({
            index: i,
            existingTradeId,
            matchType: "exact",
          });
        }
      }

      return { duplicates };
    }),

  /**
   * Import transactions into the database (optimized with batch operations).
   */
  importTransactions: protectedProcedure
    .input(
      z.object({
        transactions: z.array(
          z.object({
            ticker: z.string(),
            action: z.enum(["buy", "sell"]),
            datetime: z.string(),
            quantity: z.string(),
            price: z.string(),
            fees: z.string().optional(),
            assetClass: z
              .enum([
                "stock",
                "cryptocurrency",
                "forex",
                "futures",
                "options",
                "prediction_market",
              ])
              .optional(),
            exchange: z.string().optional(),
            notes: z.string().optional(),
          })
        ),
        skipDuplicates: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.transactions.length === 0) {
        return {
          imported: 0,
          skipped: 0,
          errors: [],
          transactionIds: [],
        };
      }

      // Get or create user's organization
      const orgId = await getOrCreateUserOrg(ctx.db, ctx.userId!);

      // Get unique tickers
      const uniqueTickers = [...new Set(input.transactions.map((t) => t.ticker.toUpperCase()))];

      // Batch fetch all existing open trades for these tickers in this org
      const existingTrades = await ctx.db
        .select()
        .from(trades)
        .where(and(eq(trades.status, "open"), eq(trades.orgId, orgId)));

      // Create map of ticker -> trade ID
      const existingTradeMap = new Map<string, string>();
      for (const trade of existingTrades) {
        if (uniqueTickers.includes(trade.instrumentTicker)) {
          existingTradeMap.set(trade.instrumentTicker, trade.id);
        }
      }

      // Prepare batch arrays
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

      const errors: Array<{ index: number; error: string }> = [];
      const importedIds: string[] = [];

      // Build batch arrays
      for (let i = 0; i < input.transactions.length; i++) {
        const tx = input.transactions[i];

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
              assetClass: tx.assetClass || "stock",
              exchange: tx.exchange || "Unknown",
              tradeDirection,
              status: "open",
              openDatetime: new Date(tx.datetime),
              feesTotal: tx.fees || "0",
            });

            // Add to map so subsequent txs for same ticker use this trade
            existingTradeMap.set(ticker, tradeId);
          }

          const transactionId = uuidv4();
          newTransactions.push({
            id: transactionId,
            tradeId,
            action: tx.action,
            quantity: tx.quantity,
            price: tx.price,
            datetime: new Date(tx.datetime),
            fees: tx.fees || "0",
            notes: tx.notes,
          });

          importedIds.push(transactionId);
        } catch (error) {
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Batch insert in chunks of 100
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
      // This fixes the bug where imported trades are never marked as closed
      const affectedTradeIds = Array.from(new Set([
        ...Array.from(existingTradeMap.values()),
        ...newTrades.map(t => t.id),
      ]));

      for (const tradeId of affectedTradeIds) {
        // Get the trade to determine direction
        const trade = await ctx.db
          .select()
          .from(trades)
          .where(eq(trades.id, tradeId))
          .limit(1);

        if (trade.length === 0) continue;

        const currentTrade = trade[0]!;

        // Get all transactions for this trade
        const allTransactions = await ctx.db
          .select()
          .from(transactions)
          .where(eq(transactions.tradeId, tradeId))
          .orderBy(transactions.datetime);

        if (allTransactions.length === 0) continue;

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

        // Calculate total fees
        const totalFees = txData.reduce(
          (sum, tx) => add(sum, tx.fees),
          toDecimal(0)
        );

        // Determine if the trade should be closed
        const isClosed = shouldCloseTrade(txData, currentTrade.tradeDirection);
        const lastTxDatetime = allTransactions[allTransactions.length - 1]?.datetime;
        const firstTxDatetime = allTransactions[0]?.datetime;

        // Update trade status
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

      return {
        imported: importedIds.length,
        skipped: 0,
        errors,
        transactionIds: importedIds,
      };
    }),

  /**
   * Check if import should use background job based on transaction count.
   */
  shouldUseBackgroundJob: protectedProcedure
    .input(z.object({ transactionCount: z.number() }))
    .query(({ input }) => {
      return {
        useBackgroundJob: input.transactionCount >= BACKGROUND_JOB_THRESHOLD,
        threshold: BACKGROUND_JOB_THRESHOLD,
      };
    }),

  /**
   * Create a background import job for large CSV imports.
   * Returns a job ID that can be polled for status.
   */
  createBackgroundImport: protectedProcedure
    .input(
      z.object({
        transactions: z.array(
          z.object({
            ticker: z.string(),
            action: z.enum(["buy", "sell"]),
            datetime: z.string(),
            quantity: z.string(),
            price: z.string(),
            fees: z.string().optional(),
            assetClass: z
              .enum([
                "stock",
                "cryptocurrency",
                "forex",
                "futures",
                "options",
                "prediction_market",
              ])
              .optional(),
            exchange: z.string().optional(),
            notes: z.string().optional(),
          })
        ),
        skipIndices: z.array(z.number()).default([]),
        provider: z.string().optional(),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const jobId = uuidv4();

      // Create job record
      await ctx.db.insert(importJobs).values({
        id: jobId,
        userId: ctx.userId || "unknown",
        type: "csv",
        status: "pending",
        totalTransactions: input.transactions.length,
        processedTransactions: 0,
        importedTransactions: 0,
        skippedTransactions: input.skipIndices.length,
        metadata: {
          provider: input.provider,
          filename: input.filename,
        },
      });

      // Return job ID - the frontend will trigger Inngest via a separate endpoint
      // or we can trigger it here if Inngest is available in this context
      return {
        jobId,
        status: "pending",
        message: "Background import job created. Processing will begin shortly.",
      };
    }),

  /**
   * Get the status of an import job.
   */
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db
        .select()
        .from(importJobs)
        .where(eq(importJobs.id, input.jobId))
        .limit(1);

      if (job.length === 0) {
        return null;
      }

      const j = job[0];
      return {
        id: j.id,
        status: j.status,
        totalTransactions: j.totalTransactions,
        processedTransactions: j.processedTransactions,
        importedTransactions: j.importedTransactions,
        skippedTransactions: j.skippedTransactions,
        errorMessage: j.errorMessage,
        errors: j.errors,
        metadata: j.metadata,
        startedAt: j.startedAt?.toISOString(),
        completedAt: j.completedAt?.toISOString(),
        createdAt: j.createdAt.toISOString(),
      };
    }),

  /**
   * Get recent import jobs for the current user.
   */
  getRecentJobs: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const jobs = await ctx.db
        .select()
        .from(importJobs)
        .where(eq(importJobs.userId, ctx.userId || ""))
        .orderBy(desc(importJobs.createdAt))
        .limit(input.limit);

      return jobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        totalTransactions: j.totalTransactions,
        importedTransactions: j.importedTransactions,
        metadata: j.metadata,
        createdAt: j.createdAt.toISOString(),
        completedAt: j.completedAt?.toISOString(),
      }));
    }),

  /**
   * Update job status (called by Inngest functions).
   */
  updateJobStatus: protectedProcedure
    .input(
      z.object({
        jobId: z.string().uuid(),
        status: z.enum(["pending", "processing", "completed", "failed"]),
        processedTransactions: z.number().optional(),
        importedTransactions: z.number().optional(),
        errorMessage: z.string().optional(),
        errors: z.array(z.object({
          index: z.number().optional(),
          ticker: z.string().optional(),
          error: z.string(),
        })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.processedTransactions !== undefined) {
        updates.processedTransactions = input.processedTransactions;
      }
      if (input.importedTransactions !== undefined) {
        updates.importedTransactions = input.importedTransactions;
      }
      if (input.errorMessage) {
        updates.errorMessage = input.errorMessage;
      }
      if (input.errors) {
        updates.errors = input.errors;
      }

      if (input.status === "processing" && !updates.startedAt) {
        updates.startedAt = new Date();
      }
      if (input.status === "completed" || input.status === "failed") {
        updates.completedAt = new Date();
      }

      await ctx.db
        .update(importJobs)
        .set(updates)
        .where(eq(importJobs.id, input.jobId));

      return { success: true };
    }),
});
