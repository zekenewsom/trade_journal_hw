/**
 * FIFO P&L Calculator
 *
 * Ported from the existing Electron app's calculateTradePnlFifoEnhanced function.
 * Uses Decimal.js for precise financial calculations.
 */

import {
  toDecimal,
  add,
  subtract,
  multiply,
  divide,
  isZero,
  isPositive,
  isNegative,
  min,
  toString,
  Decimal,
} from "../financial";
import type {
  TradeData,
  TransactionData,
  PnlCalculationResult,
  TradeOutcome,
} from "../types";

interface EntryWithRemaining extends TransactionData {
  remainingQuantity: Decimal;
}

/**
 * Calculates P&L for a trade using FIFO (First In, First Out) methodology.
 *
 * This function:
 * - Separates transactions into entries and exits based on trade direction
 * - Matches exits to entries in FIFO order
 * - Calculates realized P&L on closed portions
 * - Calculates unrealized P&L on open portions using current market price
 * - Computes average entry price for remaining open position
 * - Determines trade outcome (Win/Loss/Break Even) for closed trades
 */
export function calculateTradePnlFifo(
  trade: TradeData,
  transactions: TransactionData[]
): PnlCalculationResult {
  let realizedGrossPnl = new Decimal(0);
  let feesAttributableToClosedPortion = new Decimal(0);
  let closedQuantity = new Decimal(0);
  let totalValueForOpenEntries = new Decimal(0);
  let cumulativeEntryQuantityForOpen = new Decimal(0);

  // Separate entries and exits based on trade direction
  const isLong = trade.tradeDirection === "long";

  const entries: EntryWithRemaining[] = transactions
    .filter((tx) => (isLong && tx.action === "buy") || (!isLong && tx.action === "sell"))
    .map((tx) => ({
      ...tx,
      remainingQuantity: toDecimal(tx.quantity).abs(),
    }))
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  const exits = transactions
    .filter((tx) => (isLong && tx.action === "sell") || (!isLong && tx.action === "buy"))
    .map((tx) => ({
      ...tx,
      quantity: toDecimal(tx.quantity).abs(),
    }))
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  // Direction multiplier: Long profits when price goes up, Short profits when price goes down
  const directionMultiplier = isLong ? 1 : -1;

  // Match exits to entries using FIFO
  for (const exit of exits) {
    let exitQtyToMatch = toDecimal(exit.quantity);
    feesAttributableToClosedPortion = add(
      feesAttributableToClosedPortion,
      exit.fees
    );

    for (const entry of entries) {
      if (entry.remainingQuantity.isZero() || exitQtyToMatch.isZero()) continue;

      const matchedQty = min(exitQtyToMatch, entry.remainingQuantity);

      // Calculate P&L for this matched portion
      // For Long: P&L = (Exit Price - Entry Price) * Quantity
      // For Short: P&L = (Entry Price - Exit Price) * Quantity (hence directionMultiplier)
      const pnl = multiply(
        subtract(toDecimal(exit.price), toDecimal(entry.price)),
        matchedQty,
        directionMultiplier
      );
      realizedGrossPnl = add(realizedGrossPnl, pnl);

      // Attribute proportional entry fees to closed portion
      const entryQty = toDecimal(entry.quantity);
      if (!entryQty.isZero()) {
        const proportionalFees = multiply(
          toDecimal(entry.fees),
          divide(matchedQty, entryQty)
        );
        feesAttributableToClosedPortion = add(
          feesAttributableToClosedPortion,
          proportionalFees
        );
      }

      entry.remainingQuantity = subtract(entry.remainingQuantity, matchedQty);
      exitQtyToMatch = subtract(exitQtyToMatch, matchedQty);
      closedQuantity = add(closedQuantity, matchedQty);

      if (exitQtyToMatch.isZero()) break;
    }
  }

  // Calculate weighted average price for remaining open portion
  for (const entry of entries) {
    if (entry.remainingQuantity.greaterThan(0)) {
      totalValueForOpenEntries = add(
        totalValueForOpenEntries,
        multiply(toDecimal(entry.price), entry.remainingQuantity)
      );
      cumulativeEntryQuantityForOpen = add(
        cumulativeEntryQuantityForOpen,
        entry.remainingQuantity
      );
    }
  }

  const openQuantity = cumulativeEntryQuantityForOpen;
  let averageOpenPrice: string | null = null;

  if (openQuantity.greaterThan(0)) {
    averageOpenPrice = toString(divide(totalValueForOpenEntries, openQuantity));
  }

  // Calculate realized net P&L
  const realizedNetPnl = subtract(realizedGrossPnl, feesAttributableToClosedPortion);

  // Calculate unrealized P&L if position is open and market price is available
  let unrealizedGrossPnl: string | null = null;
  if (
    openQuantity.greaterThan(0) &&
    averageOpenPrice !== null &&
    trade.currentMarketPrice !== null
  ) {
    const unrealized = multiply(
      subtract(toDecimal(trade.currentMarketPrice), toDecimal(averageOpenPrice)),
      openQuantity,
      directionMultiplier
    );
    unrealizedGrossPnl = toString(unrealized);
  }

  // Calculate R-multiple for closed trades
  let rMultipleActual: string | null = null;
  if (
    trade.status === "closed" &&
    trade.rMultipleInitialRisk != null &&
    !isZero(trade.rMultipleInitialRisk)
  ) {
    const finalNetPnl = subtract(realizedGrossPnl, toDecimal(trade.feesTotal));
    rMultipleActual = toString(divide(finalNetPnl, toDecimal(trade.rMultipleInitialRisk)));
  }

  // Calculate duration for closed trades
  let durationMs: number | null = null;
  if (
    trade.status === "closed" &&
    trade.openDatetime &&
    trade.closeDatetime
  ) {
    durationMs =
      new Date(trade.closeDatetime).getTime() -
      new Date(trade.openDatetime).getTime();
  }

  // Determine outcome for closed trades
  let outcome: TradeOutcome | null = null;
  if (trade.status === "closed") {
    const finalNetPnl = subtract(realizedGrossPnl, toDecimal(trade.feesTotal));
    if (isPositive(finalNetPnl)) {
      outcome = "win";
    } else if (isNegative(finalNetPnl)) {
      outcome = "loss";
    } else {
      outcome = "break_even";
    }
  }

  return {
    tradeId: trade.id,
    realizedGrossPnl: toString(realizedGrossPnl),
    realizedNetPnl: toString(realizedNetPnl),
    feesAttributableToClosedPortion: toString(feesAttributableToClosedPortion),
    isFullyClosed: trade.status === "closed",
    closedQuantity: toString(closedQuantity),
    openQuantity: toString(openQuantity),
    averageOpenPrice,
    unrealizedGrossPnl,
    rMultipleActual,
    durationMs,
    outcome,
  };
}

/**
 * Determines trade direction based on the first transaction.
 */
export function determineTradeDirection(
  firstAction: "buy" | "sell"
): "long" | "short" {
  return firstAction === "buy" ? "long" : "short";
}

/**
 * Calculates the current open position size from transactions.
 */
export function calculateOpenPositionSize(
  transactions: TransactionData[],
  tradeDirection: "long" | "short"
): Decimal {
  let openSize = new Decimal(0);

  for (const tx of transactions) {
    const qty = toDecimal(tx.quantity);
    if (tradeDirection === "long") {
      openSize = tx.action === "buy" ? add(openSize, qty) : subtract(openSize, qty);
    } else {
      openSize = tx.action === "sell" ? add(openSize, qty) : subtract(openSize, qty);
    }
  }

  return openSize;
}

/**
 * Determines if a trade should be marked as closed based on transactions.
 * Uses a small tolerance to handle floating-point precision issues.
 */
export function shouldCloseTrade(
  transactions: TransactionData[],
  tradeDirection: "long" | "short"
): boolean {
  const openSize = calculateOpenPositionSize(transactions, tradeDirection);
  // Use a small tolerance (1e-8) to handle decimal precision issues
  // This accounts for tiny residuals that are effectively zero
  // Use absolute value to handle both positive tiny residuals and negative (oversold) cases
  const PRECISION_TOLERANCE = new Decimal("0.00000001");
  return openSize.abs().lessThanOrEqualTo(PRECISION_TOLERANCE);
}
