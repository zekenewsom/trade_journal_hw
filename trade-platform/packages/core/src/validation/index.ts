/**
 * Validation utilities with Zod schemas.
 *
 * Ported and enhanced from the existing Electron app's validationUtils.js
 */

import { z } from "zod";
import { isValidFinancialNumber } from "../financial";

// Custom error class for validation errors
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// Base schemas for common types
export const uuidSchema = z.string().uuid("Invalid UUID format");

export const positiveNumberSchema = z.coerce
  .number()
  .positive("Must be a positive number");

export const nonNegativeNumberSchema = z.coerce
  .number()
  .nonnegative("Must be zero or positive");

export const financialNumberSchema = z
  .union([z.string(), z.number()])
  .refine(isValidFinancialNumber, "Invalid financial number")
  .transform((val) => String(val));

export const positiveFinancialNumberSchema = financialNumberSchema.refine(
  (val) => parseFloat(val) > 0,
  "Must be a positive number"
);

export const nonNegativeFinancialNumberSchema = financialNumberSchema.refine(
  (val) => parseFloat(val) >= 0,
  "Must be zero or positive"
);

export const datetimeSchema = z.coerce.date();

export const tickerSchema = z
  .string()
  .min(1, "Ticker is required")
  .max(20, "Ticker must be 20 characters or less")
  .regex(/^[A-Za-z0-9\-\.\/]+$/, "Invalid ticker format");

// Enum schemas
export const assetClassSchema = z.enum([
  "stock",
  "cryptocurrency",
  "forex",
  "futures",
  "options",
  "prediction_market",
]);

export const tradeDirectionSchema = z.enum(["long", "short"]);

export const tradeStatusSchema = z.enum(["open", "closed"]);

export const tradeOutcomeSchema = z.enum(["win", "loss", "break_even"]);

export const transactionActionSchema = z.enum(["buy", "sell"]);

// Institutional-grade trade review schemas
export const thesisValidationSchema = z.enum(["correct", "partial", "incorrect"]);
export const planAdherenceSchema = z.enum(["high", "medium", "low"]);
export const overallRatingSchema = z.number().int().min(1).max(5);

// Transaction schemas
export const logTransactionSchema = z.object({
  instrumentTicker: tickerSchema,
  assetClass: assetClassSchema,
  exchange: z.string().min(1, "Exchange is required").max(100),
  action: transactionActionSchema,
  datetime: datetimeSchema,
  quantity: positiveFinancialNumberSchema,
  price: positiveFinancialNumberSchema,
  fees: nonNegativeFinancialNumberSchema.optional().default("0"),
  notes: z.string().max(5000).nullable().optional(),
  strategyId: uuidSchema.nullable().optional(),
  marketConditions: z.string().max(2000).nullable().optional(),
  setupDescription: z.string().max(5000).nullable().optional(),
  reasoning: z.string().max(5000).nullable().optional(),
  lessonsLearned: z.string().max(5000).nullable().optional(),
  rMultipleInitialRisk: nonNegativeFinancialNumberSchema.nullable().optional(),
  emotionIds: z.array(uuidSchema).optional().default([]),
});

export const updateTransactionSchema = z.object({
  transactionId: uuidSchema,
  quantity: positiveFinancialNumberSchema,
  price: positiveFinancialNumberSchema,
  datetime: datetimeSchema,
  fees: nonNegativeFinancialNumberSchema.optional().default("0"),
  notes: z.string().max(5000).nullable().optional(),
  strategyId: uuidSchema.nullable().optional(),
  marketConditions: z.string().max(2000).nullable().optional(),
  setupDescription: z.string().max(5000).nullable().optional(),
  reasoning: z.string().max(5000).nullable().optional(),
  lessonsLearned: z.string().max(5000).nullable().optional(),
  rMultipleInitialRisk: nonNegativeFinancialNumberSchema.nullable().optional(),
  emotionIds: z.array(uuidSchema).optional().default([]),
});

// Trade schemas
export const updateTradeMetadataSchema = z.object({
  tradeId: uuidSchema,
  strategyId: uuidSchema.nullable().optional(),
  marketConditions: z.string().max(2000).nullable().optional(),
  setupDescription: z.string().max(5000).nullable().optional(),
  reasoning: z.string().max(5000).nullable().optional(),
  lessonsLearned: z.string().max(5000).nullable().optional(),
  rMultipleInitialRisk: nonNegativeFinancialNumberSchema.nullable().optional(),
  emotionIds: z.array(uuidSchema).optional().default([]),

  // Institutional-grade trade review fields
  thesisValidation: thesisValidationSchema.nullable().optional(),
  planAdherence: planAdherenceSchema.nullable().optional(),
  planAdherenceNotes: z.string().max(2000).nullable().optional(),
  unforeseenEvents: z.string().max(5000).nullable().optional(),
  overallRating: overallRatingSchema.nullable().optional(),
  outcomeOverride: tradeOutcomeSchema.nullable().optional(),
  keyLesson1: z.string().max(500).nullable().optional(),
  keyLesson2: z.string().max(500).nullable().optional(),
  keyLesson3: z.string().max(500).nullable().optional(),
  decisionPrice: nonNegativeFinancialNumberSchema.nullable().optional(),
});

export const updateMarkPriceSchema = z.object({
  tradeId: uuidSchema,
  marketPrice: positiveFinancialNumberSchema,
});

// Analytics filter schema
export const analyticsFiltersSchema = z.object({
  dateRange: z
    .object({
      startDate: datetimeSchema.nullable().optional(),
      endDate: datetimeSchema.nullable().optional(),
    })
    .optional(),
  assetClasses: z.array(assetClassSchema).optional(),
  exchanges: z.array(z.string()).optional(),
  strategyIds: z.array(uuidSchema).optional(),
});

// Import schemas
export const csvImportRowSchema = z.object({
  ticker: tickerSchema,
  assetClass: assetClassSchema.optional(),
  exchange: z.string().optional(),
  action: transactionActionSchema,
  datetime: datetimeSchema,
  quantity: positiveFinancialNumberSchema,
  price: positiveFinancialNumberSchema,
  fees: nonNegativeFinancialNumberSchema.optional().default("0"),
  notes: z.string().nullable().optional(),
});

// Type exports
export type LogTransactionInput = z.infer<typeof logTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type UpdateTradeMetadataInput = z.infer<typeof updateTradeMetadataSchema>;
export type UpdateMarkPriceInput = z.infer<typeof updateMarkPriceSchema>;
export type AnalyticsFiltersInput = z.infer<typeof analyticsFiltersSchema>;
export type CsvImportRowInput = z.infer<typeof csvImportRowSchema>;

// Validation helper functions
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new ValidationError(
      context ? `${context}: ${errors}` : errors,
      result.error.errors[0]?.path.join("."),
      result.error.errors[0]?.code
    );
  }
  return result.data;
}

export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
