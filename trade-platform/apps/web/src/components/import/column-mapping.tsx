"use client";

import { useState, useMemo } from "react";
import { ArrowRight, Check, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ColumnMapping {
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

interface ColumnMappingProps {
  headers: string[];
  sampleData: Record<string, string>[];
  suggestedMapping?: ColumnMapping | null;
  onApply: (mapping: ColumnMapping) => void;
  onCancel: () => void;
  isApplying?: boolean;
}

const REQUIRED_FIELDS = ["ticker", "action", "datetime", "quantity", "price"] as const;
const OPTIONAL_FIELDS = ["fees", "assetClass", "exchange", "notes"] as const;

const FIELD_LABELS: Record<string, { label: string; description: string }> = {
  ticker: { label: "Ticker / Symbol", description: "Stock symbol or instrument identifier" },
  action: { label: "Action", description: "Buy or Sell" },
  datetime: { label: "Date/Time", description: "Transaction date and time" },
  quantity: { label: "Quantity", description: "Number of shares or units" },
  price: { label: "Price", description: "Price per share or unit" },
  fees: { label: "Fees", description: "Commission or transaction fees" },
  assetClass: { label: "Asset Class", description: "Stock, crypto, options, etc." },
  exchange: { label: "Exchange", description: "Exchange or platform name" },
  notes: { label: "Notes", description: "Additional notes or comments" },
};

const UNMAPPED_VALUE = "__unmapped__";

export function ColumnMapping({
  headers,
  sampleData,
  suggestedMapping,
  onApply,
  onCancel,
  isApplying = false,
}: ColumnMappingProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => {
    // Start with suggested mapping or try to auto-map common column names
    if (suggestedMapping) return suggestedMapping;

    const autoMapping: ColumnMapping = {};
    const lowerHeaders = headers.map((h) => h.toLowerCase());

    // Auto-detect common column names
    const mappings: Record<string, string[]> = {
      ticker: ["ticker", "symbol", "instrument", "stock", "asset"],
      action: ["action", "side", "type", "transaction type", "trans. type", "activity"],
      datetime: ["date", "datetime", "time", "executed", "executed at", "trade date"],
      quantity: ["quantity", "qty", "shares", "amount", "units", "size"],
      price: ["price", "avg price", "average price", "fill price", "execution price"],
      fees: ["fees", "fee", "commission", "comm"],
      exchange: ["exchange", "market", "venue"],
      notes: ["notes", "memo", "description", "comments"],
    };

    for (const [field, patterns] of Object.entries(mappings)) {
      for (const pattern of patterns) {
        const idx = lowerHeaders.findIndex((h) => h.includes(pattern));
        if (idx !== -1) {
          autoMapping[field as keyof ColumnMapping] = headers[idx];
          break;
        }
      }
    }

    return autoMapping;
  });

  const updateMapping = (field: string, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value === UNMAPPED_VALUE ? undefined : value,
    }));
  };

  const missingRequired = useMemo(() => {
    return REQUIRED_FIELDS.filter((field) => !mapping[field]);
  }, [mapping]);

  const isValid = missingRequired.length === 0;

  const handleApply = () => {
    if (isValid) {
      onApply(mapping);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Map Columns</CardTitle>
          <CardDescription>
            Match your CSV columns to the required transaction fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Required Fields */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Required Fields</h3>
            <div className="space-y-3">
              {REQUIRED_FIELDS.map((field) => (
                <FieldMapping
                  key={field}
                  field={field}
                  headers={headers}
                  sampleData={sampleData}
                  currentValue={mapping[field]}
                  onChange={(value) => updateMapping(field, value)}
                  isRequired
                />
              ))}
            </div>
          </div>

          {/* Optional Fields */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Optional Fields
            </h3>
            <div className="space-y-3">
              {OPTIONAL_FIELDS.map((field) => (
                <FieldMapping
                  key={field}
                  field={field}
                  headers={headers}
                  sampleData={sampleData}
                  currentValue={mapping[field]}
                  onChange={(value) => updateMapping(field, value)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sample Data Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sample Data Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-medium text-muted-foreground">Row</th>
                  {REQUIRED_FIELDS.map((field) => (
                    <th key={field} className="p-2 text-left font-medium">
                      {FIELD_LABELS[field].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleData.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    {REQUIRED_FIELDS.map((field) => (
                      <td key={field} className="p-2 font-mono">
                        {mapping[field] ? (
                          row[mapping[field]] || <span className="text-muted-foreground">-</span>
                        ) : (
                          <span className="text-destructive">Not mapped</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Validation */}
      {!isValid && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Missing required mappings: {missingRequired.map((f) => FIELD_LABELS[f].label).join(", ")}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onCancel} disabled={isApplying}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={!isValid || isApplying}
          className="gap-2"
        >
          {isApplying ? (
            "Applying..."
          ) : (
            <>
              <Check className="h-4 w-4" />
              Apply Mapping & Preview
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface FieldMappingProps {
  field: string;
  headers: string[];
  sampleData: Record<string, string>[];
  currentValue?: string;
  onChange: (value: string) => void;
  isRequired?: boolean;
}

function FieldMapping({
  field,
  headers,
  sampleData,
  currentValue,
  onChange,
  isRequired = false,
}: FieldMappingProps) {
  const fieldInfo = FIELD_LABELS[field];
  const sampleValue = currentValue && sampleData[0] ? sampleData[0][currentValue] : null;

  return (
    <div className="flex items-center gap-4">
      <div className="w-40">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{fieldInfo.label}</span>
          {isRequired && <Badge variant="outline" className="text-[10px]">Required</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{fieldInfo.description}</p>
      </div>

      <ArrowRight className="h-4 w-4 text-muted-foreground" />

      <Select value={currentValue || UNMAPPED_VALUE} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            "w-56",
            isRequired && !currentValue && "border-destructive"
          )}
        >
          <SelectValue placeholder="Select column..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNMAPPED_VALUE}>
            <span className="text-muted-foreground">-- Not mapped --</span>
          </SelectItem>
          {headers.map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {sampleValue && (
        <div className="flex-1 min-w-0">
          <span className="text-xs text-muted-foreground">Sample: </span>
          <span className="text-xs font-mono truncate">{sampleValue}</span>
        </div>
      )}
    </div>
  );
}
