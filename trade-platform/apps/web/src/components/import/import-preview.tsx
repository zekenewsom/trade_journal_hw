"use client";

import { Check, X, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";

interface ParsedTransaction {
  ticker: string;
  action: "buy" | "sell";
  datetime: string;
  quantity: string;
  price: string;
  fees?: string;
  assetClass?: string;
  exchange?: string;
  notes?: string;
  rowNumber?: number;
}

interface ParseError {
  row?: number;
  field?: string;
  message: string;
}

interface ImportPreviewProps {
  transactions: ParsedTransaction[];
  errors: ParseError[];
  warnings: ParseError[];
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  provider?: string;
  onImport: () => void;
  onCancel: () => void;
  isImporting?: boolean;
}

export function ImportPreview({
  transactions,
  errors,
  warnings,
  totalRows,
  successfulRows,
  failedRows,
  provider,
  onImport,
  onCancel,
  isImporting = false,
}: ImportPreviewProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalRows}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valid Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{successfulRows}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed Rows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{failedRows}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Detected Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold capitalize">
              {provider || "Generic"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" />
              Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {errors.slice(0, 10).map((error, i) => (
                <li key={i} className="text-destructive">
                  {error.row && `Row ${error.row}: `}
                  {error.message}
                </li>
              ))}
              {errors.length > 10 && (
                <li className="text-muted-foreground">
                  ...and {errors.length - 10} more errors
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-5 w-5" />
              Warnings ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-yellow-600 dark:text-yellow-400">
              {warnings.slice(0, 5).map((warning, i) => (
                <li key={i}>
                  {warning.row && `Row ${warning.row}: `}
                  {warning.message}
                </li>
              ))}
              {warnings.length > 5 && (
                <li className="text-muted-foreground">
                  ...and {warnings.length - 5} more warnings
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Transaction Preview Table */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 20).map((tx, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">
                        {tx.rowNumber || i + 1}
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {tx.ticker}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.action === "buy" ? "default" : "secondary"}
                        >
                          {tx.action.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(new Date(tx.datetime))}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {tx.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(Number(tx.price))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {tx.fees ? formatCurrency(Number(tx.fees)) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {transactions.length > 20 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Showing first 20 of {transactions.length} transactions
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onCancel} disabled={isImporting}>
          Cancel
        </Button>
        <Button
          onClick={onImport}
          disabled={isImporting || successfulRows === 0}
          className="gap-2"
        >
          {isImporting ? (
            "Importing..."
          ) : (
            <>
              <Check className="h-4 w-4" />
              Import {successfulRows} Transactions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
