"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Check, X, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DuplicateInfo {
  index: number;
  existingTradeId: string;
  matchType: "exact" | "fuzzy";
}

interface ParsedTransaction {
  ticker: string;
  action: "buy" | "sell";
  datetime: string;
  quantity: string;
  price: string;
  fees?: string;
  rowNumber?: number;
}

interface DuplicateResolutionProps {
  transactions: ParsedTransaction[];
  duplicates: DuplicateInfo[];
  onProceed: (skipIndices: number[]) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

type ResolutionAction = "skip_all" | "import_all" | "review";

export function DuplicateResolution({
  transactions,
  duplicates,
  onProceed,
  onCancel,
  isProcessing = false,
}: DuplicateResolutionProps) {
  const [action, setAction] = useState<ResolutionAction>("skip_all");
  const [selectedSkipIndices, setSelectedSkipIndices] = useState<Set<number>>(
    () => new Set(duplicates.map((d) => d.index))
  );

  const duplicateTransactions = useMemo(() => {
    return duplicates.map((d) => ({
      ...d,
      transaction: transactions[d.index],
    }));
  }, [duplicates, transactions]);

  const handleToggleSkip = (index: number) => {
    setSelectedSkipIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleProceed = () => {
    let skipIndices: number[];

    switch (action) {
      case "skip_all":
        skipIndices = duplicates.map((d) => d.index);
        break;
      case "import_all":
        skipIndices = [];
        break;
      case "review":
        skipIndices = Array.from(selectedSkipIndices);
        break;
    }

    onProceed(skipIndices);
  };

  const nonDuplicateCount = transactions.length - duplicates.length;
  const willImportCount =
    action === "skip_all"
      ? nonDuplicateCount
      : action === "import_all"
        ? transactions.length
        : transactions.length - selectedSkipIndices.size;

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            Duplicates Detected
          </CardTitle>
          <CardDescription>
            Found {duplicates.length} potential duplicate{duplicates.length !== 1 ? "s" : ""} in your import file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            These transactions appear to already exist in your trade history.
            Choose how to handle them below.
          </p>
        </CardContent>
      </Card>

      {/* Resolution Options */}
      <Card>
        <CardHeader>
          <CardTitle>How would you like to proceed?</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={action} onValueChange={(v) => setAction(v as ResolutionAction)}>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="skip_all" id="skip_all" />
                <div className="space-y-1">
                  <Label htmlFor="skip_all" className="font-medium cursor-pointer">
                    Skip all duplicates (recommended)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Import only new transactions, skip {duplicates.length} duplicate(s)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="import_all" id="import_all" />
                <div className="space-y-1">
                  <Label htmlFor="import_all" className="font-medium cursor-pointer">
                    Import all anyway
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Import all transactions including potential duplicates
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="review" id="review" />
                <div className="space-y-1">
                  <Label htmlFor="review" className="font-medium cursor-pointer">
                    Review individually
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Choose which duplicates to skip or import
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Individual Review */}
      {action === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Review Duplicates</CardTitle>
            <CardDescription>
              Check the transactions you want to skip
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {duplicateTransactions.map(({ index, transaction, matchType }) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border p-3",
                    selectedSkipIndices.has(index) && "bg-muted/50"
                  )}
                >
                  <Checkbox
                    id={`dup-${index}`}
                    checked={selectedSkipIndices.has(index)}
                    onCheckedChange={() => handleToggleSkip(index)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{transaction.ticker}</span>
                      <Badge variant={transaction.action === "buy" ? "default" : "secondary"}>
                        {transaction.action.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {matchType} match
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(new Date(transaction.datetime))} - {transaction.quantity} @ {formatCurrency(Number(transaction.price))}
                    </div>
                  </div>
                  <Label htmlFor={`dup-${index}`} className="text-sm cursor-pointer">
                    {selectedSkipIndices.has(index) ? "Skip" : "Import"}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Import Summary</p>
              <p className="text-sm text-muted-foreground">
                {willImportCount} of {transactions.length} transactions will be imported
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-500">
                <Check className="inline h-4 w-4 mr-1" />
                {willImportCount} to import
              </span>
              <span className="text-muted-foreground">
                <X className="inline h-4 w-4 mr-1" />
                {transactions.length - willImportCount} to skip
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
          Back to Preview
        </Button>
        <Button onClick={handleProceed} disabled={isProcessing || willImportCount === 0}>
          {isProcessing ? (
            "Processing..."
          ) : (
            <>
              <ArrowRight className="mr-2 h-4 w-4" />
              Import {willImportCount} Transactions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
