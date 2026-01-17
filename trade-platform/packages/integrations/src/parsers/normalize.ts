import type { TransactionAction, AssetClass } from "@trade-platform/core";
import type { ParsedTransaction, ColumnMapping, ProviderConfig } from "../types";

/**
 * Normalize a row into a ParsedTransaction.
 */
export function normalizeTransaction(
  row: Record<string, string>,
  mapping: ColumnMapping,
  providerConfig?: ProviderConfig | null,
  rowNumber?: number
): ParsedTransaction | null {
  // Extract values using column mapping
  const tickerRaw = mapping.ticker ? row[mapping.ticker] : null;
  const actionRaw = mapping.action ? row[mapping.action] : null;
  const datetimeRaw = mapping.datetime ? row[mapping.datetime] : null;
  const quantityRaw = mapping.quantity ? row[mapping.quantity] : null;
  const priceRaw = mapping.price ? row[mapping.price] : null;
  const feesRaw = mapping.fees ? row[mapping.fees] : null;
  const assetClassRaw = mapping.assetClass ? row[mapping.assetClass] : null;
  const exchangeRaw = mapping.exchange ? row[mapping.exchange] : null;
  const notesRaw = mapping.notes ? row[mapping.notes] : null;

  // Validate required fields
  if (!tickerRaw || !actionRaw || !datetimeRaw || !quantityRaw || !priceRaw) {
    return null;
  }

  // Parse action
  let action: TransactionAction | null = null;
  if (providerConfig?.transforms?.action) {
    action = providerConfig.transforms.action(actionRaw);
  } else {
    action = normalizeAction(actionRaw);
  }
  if (!action) return null;

  // Parse datetime
  let datetime: Date | null = null;
  if (providerConfig?.transforms?.datetime) {
    datetime = providerConfig.transforms.datetime(datetimeRaw);
  } else {
    datetime = parseDatetime(datetimeRaw);
  }
  if (!datetime) return null;

  // Parse quantity
  let quantity: string | null = null;
  if (providerConfig?.transforms?.quantity) {
    quantity = providerConfig.transforms.quantity(quantityRaw);
  } else {
    quantity = normalizeNumber(quantityRaw);
  }
  if (!quantity) return null;

  // Parse price
  let price: string | null = null;
  if (providerConfig?.transforms?.price) {
    price = providerConfig.transforms.price(priceRaw);
  } else {
    price = normalizeNumber(priceRaw);
  }
  if (!price) return null;

  // Parse optional fields
  const fees = feesRaw ? normalizeNumber(feesRaw) : undefined;
  const assetClass = assetClassRaw ? normalizeAssetClass(assetClassRaw) : undefined;
  const exchange = exchangeRaw?.trim() || undefined;
  const notes = notesRaw?.trim() || undefined;

  return {
    ticker: normalizeTicker(tickerRaw),
    action,
    datetime,
    quantity,
    price,
    fees: fees || "0",
    assetClass,
    exchange,
    notes,
    rawRow: row,
    rowNumber,
  };
}

/**
 * Normalize action string to TransactionAction.
 */
export function normalizeAction(action: string): TransactionAction | null {
  const normalized = action.toLowerCase().trim();

  if (["buy", "bought", "long", "open long", "cover"].includes(normalized)) {
    return "buy";
  }
  if (["sell", "sold", "short", "open short", "close"].includes(normalized)) {
    return "sell";
  }

  return null;
}

/**
 * Parse a datetime string into a Date object.
 */
export function parseDatetime(value: string): Date | null {
  if (!value) return null;

  // Try standard ISO format first
  let date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try common US formats: MM/DD/YYYY, MM-DD-YYYY
  const usMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i);
  if (usMatch) {
    const [, month, day, year, hours, minutes, seconds, ampm] = usMatch;
    let hour = parseInt(hours || "0");
    if (ampm?.toUpperCase() === "PM" && hour < 12) hour += 12;
    if (ampm?.toUpperCase() === "AM" && hour === 12) hour = 0;

    date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hour,
      parseInt(minutes || "0"),
      parseInt(seconds || "0")
    );
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try YYYY-MM-DD format
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoMatch) {
    const [, year, month, day, hours, minutes, seconds] = isoMatch;
    date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours || "0"),
      parseInt(minutes || "0"),
      parseInt(seconds || "0")
    );
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Normalize a number string (remove currency symbols, commas, etc.)
 */
export function normalizeNumber(value: string): string | null {
  if (!value) return null;

  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$€£¥,\s]/g, "").trim();

  // Handle parentheses for negative numbers
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch) {
    const num = parseFloat(parenMatch[1]);
    if (!isNaN(num)) {
      return (-num).toString();
    }
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  // Return absolute value for quantity (negative quantities handled by action)
  return Math.abs(num).toString();
}

/**
 * Normalize ticker symbol.
 */
export function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().trim();
}

/**
 * Normalize asset class string.
 */
export function normalizeAssetClass(value: string): AssetClass | undefined {
  const normalized = value.toLowerCase().trim();

  const mappings: Record<string, AssetClass> = {
    stock: "stock",
    stocks: "stock",
    equity: "stock",
    equities: "stock",
    crypto: "cryptocurrency",
    cryptocurrency: "cryptocurrency",
    "crypto currency": "cryptocurrency",
    bitcoin: "cryptocurrency",
    forex: "forex",
    fx: "forex",
    currency: "forex",
    futures: "futures",
    future: "futures",
    options: "options",
    option: "options",
    prediction: "prediction_market",
    "prediction market": "prediction_market",
    event: "prediction_market",
  };

  return mappings[normalized];
}
