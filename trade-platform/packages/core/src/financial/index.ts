/**
 * Financial utilities using Decimal.js for precise financial calculations.
 * This eliminates JavaScript floating-point arithmetic errors.
 *
 * Ported from the existing Electron app's financialUtils.js
 */

import Decimal from "decimal.js";

// Configure Decimal.js for financial precision (20 decimal places)
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Converts a value to Decimal, handling various input types safely.
 */
export function toDecimal(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }
  if (value instanceof Decimal) {
    return value;
  }
  try {
    return new Decimal(value);
  } catch {
    console.warn(`Invalid decimal value: ${value}, defaulting to 0`);
    return new Decimal(0);
  }
}

/**
 * Adds two or more decimal values with precision.
 */
export function add(...values: (string | number | Decimal)[]): Decimal {
  return values.reduce<Decimal>(
    (acc, val) => acc.plus(toDecimal(val)),
    new Decimal(0)
  );
}

/**
 * Subtracts values from the first value with precision.
 */
export function subtract(
  initial: string | number | Decimal,
  ...values: (string | number | Decimal)[]
): Decimal {
  return values.reduce<Decimal>(
    (acc, val) => acc.minus(toDecimal(val)),
    toDecimal(initial)
  );
}

/**
 * Multiplies two or more decimal values with precision.
 */
export function multiply(...values: (string | number | Decimal)[]): Decimal {
  if (values.length === 0) return new Decimal(0);
  return values.reduce<Decimal>(
    (acc, val, idx) => (idx === 0 ? toDecimal(val) : acc.times(toDecimal(val))),
    new Decimal(1)
  );
}

/**
 * Divides the first value by subsequent values with precision.
 * Returns 0 if dividing by zero.
 */
export function divide(
  numerator: string | number | Decimal,
  ...denominators: (string | number | Decimal)[]
): Decimal {
  let result = toDecimal(numerator);

  for (const denominator of denominators) {
    const d = toDecimal(denominator);
    if (d.isZero()) {
      console.warn("Division by zero, returning 0");
      return new Decimal(0);
    }
    result = result.dividedBy(d);
  }

  return result;
}

/**
 * Returns the absolute value of a decimal.
 */
export function abs(value: string | number | Decimal): Decimal {
  return toDecimal(value).abs();
}

/**
 * Returns the minimum of the provided values.
 */
export function min(...values: (string | number | Decimal)[]): Decimal {
  if (values.length === 0) return new Decimal(0);
  return Decimal.min(...values.map(toDecimal));
}

/**
 * Returns the maximum of the provided values.
 */
export function max(...values: (string | number | Decimal)[]): Decimal {
  if (values.length === 0) return new Decimal(0);
  return Decimal.max(...values.map(toDecimal));
}

/**
 * Compares two decimal values.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compare(
  a: string | number | Decimal,
  b: string | number | Decimal
): -1 | 0 | 1 {
  const comparison = toDecimal(a).comparedTo(toDecimal(b));
  return comparison as -1 | 0 | 1;
}

/**
 * Checks if two decimal values are equal.
 */
export function equals(
  a: string | number | Decimal,
  b: string | number | Decimal
): boolean {
  return toDecimal(a).equals(toDecimal(b));
}

/**
 * Checks if a value is greater than another.
 */
export function greaterThan(
  a: string | number | Decimal,
  b: string | number | Decimal
): boolean {
  return toDecimal(a).greaterThan(toDecimal(b));
}

/**
 * Checks if a value is less than another.
 */
export function lessThan(
  a: string | number | Decimal,
  b: string | number | Decimal
): boolean {
  return toDecimal(a).lessThan(toDecimal(b));
}

/**
 * Checks if a value is zero (with tolerance for floating-point comparison).
 */
export function isZero(
  value: string | number | Decimal,
  tolerance: number = 0.000001
): boolean {
  return toDecimal(value).abs().lessThanOrEqualTo(tolerance);
}

/**
 * Checks if a value is positive (greater than tolerance).
 */
export function isPositive(
  value: string | number | Decimal,
  tolerance: number = 0.000001
): boolean {
  return toDecimal(value).greaterThan(tolerance);
}

/**
 * Checks if a value is negative (less than -tolerance).
 */
export function isNegative(
  value: string | number | Decimal,
  tolerance: number = 0.000001
): boolean {
  return toDecimal(value).lessThan(-tolerance);
}

/**
 * Rounds a decimal to the specified number of decimal places.
 */
export function round(
  value: string | number | Decimal,
  decimalPlaces: number = 2
): Decimal {
  return toDecimal(value).toDecimalPlaces(decimalPlaces);
}

/**
 * Formats a decimal as a currency string.
 */
export function formatCurrency(
  value: string | number | Decimal,
  locale: string = "en-US",
  currency: string = "USD"
): string {
  const numValue = toDecimal(value).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

/**
 * Formats a decimal as a percentage string.
 */
export function formatPercentage(
  value: string | number | Decimal,
  decimalPlaces: number = 2
): string {
  const percentage = multiply(value, 100);
  return `${round(percentage, decimalPlaces).toString()}%`;
}

/**
 * Converts a Decimal to a string for storage.
 */
export function toString(value: string | number | Decimal): string {
  return toDecimal(value).toString();
}

/**
 * Converts a Decimal to a number (use with caution - may lose precision).
 */
export function toNumber(value: string | number | Decimal): number {
  return toDecimal(value).toNumber();
}

/**
 * Validates if a value is a valid financial number.
 */
export function isValidFinancialNumber(
  value: unknown
): value is string | number {
  if (typeof value === "number") {
    return !isNaN(value) && isFinite(value);
  }
  if (typeof value === "string") {
    try {
      const decimal = new Decimal(value);
      return decimal.isFinite();
    } catch {
      return false;
    }
  }
  return false;
}

// Re-export Decimal class for advanced usage
export { Decimal };
