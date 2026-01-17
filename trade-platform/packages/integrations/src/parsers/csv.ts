import Papa from "papaparse";
import type { ParseResult, ParsedTransaction, ParseError, ParseWarning, ColumnMapping, ProviderConfig } from "../types";
import { detectProvider, getProviderConfig } from "./providers";
import { normalizeTransaction } from "./normalize";

/**
 * Parse a CSV string into transactions.
 */
export function parseCSV(
  content: string,
  options?: {
    provider?: string;
    columnMapping?: ColumnMapping;
  }
): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  // Parse CSV with PapaParse
  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parseResult.errors.length > 0) {
    for (const error of parseResult.errors) {
      errors.push({
        row: error.row,
        message: error.message,
      });
    }
  }

  const rows = parseResult.data;
  if (rows.length === 0) {
    return {
      success: false,
      transactions: [],
      errors: [{ message: "No data rows found in CSV" }],
      warnings: [],
      totalRows: 0,
      successfulRows: 0,
      failedRows: 0,
    };
  }

  const headers = parseResult.meta.fields || [];
  const firstRow = rows[0];

  // Detect or use provided provider
  let providerConfig: ProviderConfig | null = null;
  let detectedProvider: string | undefined;

  if (options?.provider) {
    providerConfig = getProviderConfig(options.provider);
    detectedProvider = options.provider;
  } else {
    const detected = detectProvider(headers, firstRow);
    if (detected) {
      providerConfig = detected;
      detectedProvider = detected.id;
    }
  }

  // Use custom column mapping if provided, otherwise use provider's mapping
  const columnMapping = options?.columnMapping || providerConfig?.columnMapping;

  if (!columnMapping) {
    return {
      success: false,
      transactions: [],
      errors: [{ message: "Unable to detect file format. Please select a provider or map columns manually." }],
      warnings: [],
      provider: detectedProvider,
      totalRows: rows.length,
      successfulRows: 0,
      failedRows: rows.length,
    };
  }

  // Parse each row
  let successfulRows = 0;
  let failedRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 for header row and 1-based indexing

    try {
      const transaction = normalizeTransaction(row, columnMapping, providerConfig, rowNumber);

      if (transaction) {
        transactions.push(transaction);
        successfulRows++;
      } else {
        failedRows++;
        errors.push({
          row: rowNumber,
          message: "Failed to parse row",
        });
      }
    } catch (error) {
      failedRows++;
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    success: successfulRows > 0,
    transactions,
    errors,
    warnings,
    provider: detectedProvider,
    detectedFormat: providerConfig?.name,
    totalRows: rows.length,
    successfulRows,
    failedRows,
  };
}

/**
 * Parse CSV file from a File object (browser).
 */
export function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(parseCSV(content));
    };
    reader.onerror = () => {
      resolve({
        success: false,
        transactions: [],
        errors: [{ message: "Failed to read file" }],
        warnings: [],
        totalRows: 0,
        successfulRows: 0,
        failedRows: 0,
      });
    };
    reader.readAsText(file);
  });
}
