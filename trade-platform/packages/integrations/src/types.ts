import type { AssetClass, TransactionAction } from "@trade-platform/core";

/**
 * Represents a single parsed row from an import file.
 * This is the normalized format that all parsers output.
 */
export interface ParsedTransaction {
  ticker: string;
  assetClass?: AssetClass;
  exchange?: string;
  action: TransactionAction;
  datetime: Date;
  quantity: string;
  price: string;
  fees?: string;
  notes?: string;
  // Original row data for debugging/display
  rawRow?: Record<string, unknown>;
  // Row number in the original file
  rowNumber?: number;
}

/**
 * Result of parsing an import file.
 */
export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  errors: ParseError[];
  warnings: ParseWarning[];
  provider?: string;
  detectedFormat?: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
}

/**
 * An error that occurred during parsing.
 */
export interface ParseError {
  row?: number;
  field?: string;
  message: string;
  value?: unknown;
}

/**
 * A warning during parsing (non-fatal issue).
 */
export interface ParseWarning {
  row?: number;
  field?: string;
  message: string;
  value?: unknown;
}

/**
 * Column mapping configuration for custom imports.
 */
export interface ColumnMapping {
  ticker?: string;
  action?: string;
  datetime?: string;
  quantity?: string;
  price?: string;
  fees?: string;
  assetClass?: string;
  exchange?: string;
  notes?: string;
}

/**
 * Supported import file types.
 */
export type ImportFileType = "csv" | "xlsx" | "xls";

/**
 * Supported broker/platform providers.
 */
export type ImportProvider =
  | "robinhood"
  | "tradingview"
  | "thinkorswim"
  | "ibkr"
  | "generic";

/**
 * Configuration for a provider parser.
 */
export interface ProviderConfig {
  id: ImportProvider;
  name: string;
  description: string;
  supportedFileTypes: ImportFileType[];
  // Function to detect if a file is from this provider
  detect: (headers: string[], firstRow?: Record<string, unknown>) => boolean;
  // Column mapping for this provider
  columnMapping: ColumnMapping;
  // Custom transform functions
  transforms?: {
    action?: (value: string) => TransactionAction | null;
    datetime?: (value: string) => Date | null;
    quantity?: (value: string) => string | null;
    price?: (value: string) => string | null;
  };
}

/**
 * Duplicate detection result.
 */
export interface DuplicateCheck {
  isDuplicate: boolean;
  existingTradeId?: string;
  matchType?: "exact" | "fuzzy";
  matchFields?: string[];
  confidence?: number;
}

/**
 * Import preview data shown to user before confirmation.
 */
export interface ImportPreview {
  provider: ImportProvider | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  transactions: ParsedTransaction[];
  errors: ParseError[];
  warnings: ParseWarning[];
  duplicates: Array<{
    transaction: ParsedTransaction;
    existingTradeId: string;
    matchType: "exact" | "fuzzy";
  }>;
}
