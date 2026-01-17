import type { ProviderConfig } from "../../types";
import type { TransactionAction } from "@trade-platform/core";

/**
 * Robinhood CSV export format parser.
 *
 * Robinhood exports trades in CSV format with columns like:
 * - Activity Date: Date of the transaction
 * - Process Date: Processing date
 * - Settle Date: Settlement date
 * - Instrument: Stock symbol
 * - Description: Transaction description
 * - Trans Code: Transaction type (Buy, Sell, etc.)
 * - Quantity: Number of shares
 * - Price: Price per share
 * - Amount: Total transaction amount
 *
 * Note: Robinhood format may vary slightly between export types.
 * This parser handles the most common "Account Statement" export format.
 */
export const robinhoodConfig: ProviderConfig = {
  id: "robinhood",
  name: "Robinhood",
  description: "Import trades from Robinhood account statement CSV export",
  supportedFileTypes: ["csv"],

  detect: (headers: string[]): boolean => {
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

    // Check for Robinhood-specific columns
    const robinhoodColumns = [
      "activity date",
      "instrument",
      "trans code",
      "quantity",
      "price",
    ];

    // Alternative column names for different Robinhood export formats
    const altColumns = [
      "symbol",
      "side",
      "qty",
      "average price",
    ];

    const hasRobinhoodFormat = robinhoodColumns.every((col) =>
      normalizedHeaders.some((h) => h.includes(col.toLowerCase()))
    );

    const hasAltFormat = altColumns.every((col) =>
      normalizedHeaders.some((h) => h.includes(col.toLowerCase()))
    );

    return hasRobinhoodFormat || hasAltFormat;
  },

  columnMapping: {
    ticker: "Instrument",
    action: "Trans Code",
    datetime: "Activity Date",
    quantity: "Quantity",
    price: "Price",
    fees: "Fees",
    notes: "Description",
  },

  transforms: {
    action: (value: string): TransactionAction | null => {
      const normalized = value.toLowerCase().trim();

      // Robinhood transaction codes
      if (["buy", "mkt buy", "lmt buy", "stp buy"].some((code) => normalized.includes(code))) {
        return "buy";
      }
      if (["sell", "mkt sell", "lmt sell", "stp sell"].some((code) => normalized.includes(code))) {
        return "sell";
      }

      // Handle options assignments/exercises
      if (normalized.includes("exercise") || normalized.includes("assign")) {
        // These would need special handling based on position direction
        // For now, return null to skip them
        return null;
      }

      // Skip non-trade transactions
      if (
        normalized.includes("dividend") ||
        normalized.includes("interest") ||
        normalized.includes("deposit") ||
        normalized.includes("withdrawal") ||
        normalized.includes("transfer") ||
        normalized.includes("fee") ||
        normalized.includes("acat")
      ) {
        return null;
      }

      return null;
    },

    datetime: (value: string): Date | null => {
      if (!value) return null;

      // Robinhood typically uses MM/DD/YYYY format
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) {
        const [, month, day, year] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // Try standard date parsing as fallback
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    },

    quantity: (value: string): string | null => {
      if (!value) return null;
      // Remove any commas and parse
      const cleaned = value.replace(/,/g, "").trim();
      const num = parseFloat(cleaned);
      if (isNaN(num) || num === 0) return null;
      return Math.abs(num).toString();
    },

    price: (value: string): string | null => {
      if (!value) return null;
      // Remove $ and commas
      const cleaned = value.replace(/[$,]/g, "").trim();
      const num = parseFloat(cleaned);
      if (isNaN(num) || num <= 0) return null;
      return num.toString();
    },
  },
};

/**
 * Alternative Robinhood format (from newer exports or different report types).
 * This can be added as a separate provider if needed.
 */
export const robinhoodAltColumnMapping = {
  ticker: "Symbol",
  action: "Side",
  datetime: "Date",
  quantity: "Qty",
  price: "Average Price",
  fees: "Commission",
  notes: "Description",
};
