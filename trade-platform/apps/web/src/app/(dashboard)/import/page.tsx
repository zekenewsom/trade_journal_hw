"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/import/file-upload";
import { ImportPreview } from "@/components/import/import-preview";
import { ColumnMapping } from "@/components/import/column-mapping";
import { DuplicateResolution } from "@/components/import/duplicate-resolution";
import { api } from "@/trpc/react";
import { toast } from "@/components/ui/use-toast";

type ImportStep = "upload" | "mapping" | "preview" | "duplicates" | "complete";

interface DuplicateInfo {
  index: number;
  existingTradeId: string;
  matchType: "exact" | "fuzzy";
}

interface ColumnMappingData {
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

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("upload");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [parseResult, setParseResult] = useState<{
    transactions: ParsedTransaction[];
    errors: Array<{ row?: number; field?: string; message: string }>;
    warnings: Array<{ row?: number; field?: string; message: string }>;
    totalRows: number;
    successfulRows: number;
    failedRows: number;
    provider?: string;
  } | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  // Column mapping state
  const [csvHeaders, setCSVHeaders] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<Record<string, string>[]>([]);
  const [suggestedMapping, setSuggestedMapping] = useState<ColumnMappingData | null>(null);

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);

  const { data: providers } = api.imports.getProviders.useQuery();
  const parseCSV = api.imports.parseCSV.useMutation();
  const getCSVHeaders = api.imports.getCSVHeaders.useMutation();
  const checkDuplicates = api.imports.checkDuplicates.useMutation();
  const importTransactions = api.imports.importTransactions.useMutation();

  const handleFileSelect = async (file: File, content: string) => {
    setFileContent(content);

    try {
      const result = await parseCSV.mutateAsync({
        content,
        provider: selectedProvider || undefined,
      });

      setParseResult({
        transactions: result.transactions as ParsedTransaction[],
        errors: result.errors,
        warnings: result.warnings,
        totalRows: result.totalRows,
        successfulRows: result.successfulRows,
        failedRows: result.failedRows,
        provider: result.provider,
      });

      if (result.successfulRows > 0) {
        setStep("preview");
      } else {
        // Auto-detection failed, show column mapping UI
        try {
          const headersResult = await getCSVHeaders.mutateAsync({ content });
          setCSVHeaders(headersResult.headers);
          setSampleData(headersResult.sampleData);
          setSuggestedMapping(headersResult.suggestedMapping);
          setStep("mapping");
          toast({
            title: "Format not recognized",
            description: "Please map your CSV columns to the required fields.",
          });
        } catch {
          toast({
            title: "Failed to parse file",
            description: "Unable to read CSV headers.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error parsing file",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleApplyMapping = async (mapping: ColumnMappingData) => {
    try {
      const result = await parseCSV.mutateAsync({
        content: fileContent,
        columnMapping: mapping,
      });

      setParseResult({
        transactions: result.transactions as ParsedTransaction[],
        errors: result.errors,
        warnings: result.warnings,
        totalRows: result.totalRows,
        successfulRows: result.successfulRows,
        failedRows: result.failedRows,
        provider: "custom",
      });

      if (result.successfulRows > 0) {
        setStep("preview");
      } else {
        toast({
          title: "Parsing failed",
          description: "No valid transactions found with this mapping. Please check your selections.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error applying mapping",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!parseResult?.transactions.length) return;

    try {
      // Try to check for duplicates, but don't block import if it fails
      let duplicateResult: { duplicates: DuplicateInfo[] } = { duplicates: [] };

      try {
        duplicateResult = await checkDuplicates.mutateAsync({
          transactions: parseResult.transactions.map((tx) => ({
            ticker: tx.ticker,
            action: tx.action,
            datetime: tx.datetime,
            quantity: tx.quantity,
            price: tx.price,
          })),
        });
      } catch (dupError) {
        console.error("Duplicate check failed, proceeding with import:", dupError);
        // Continue with import even if duplicate check fails
      }

      if (duplicateResult.duplicates.length > 0) {
        // Found duplicates, show resolution UI
        setDuplicates(duplicateResult.duplicates);
        setStep("duplicates");
        return;
      }

      // No duplicates, proceed with import
      await performImport([]);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateResolution = async (skipIndices: number[]) => {
    await performImport(skipIndices);
  };

  const performImport = async (skipIndices: number[]) => {
    if (!parseResult?.transactions.length) {
      console.error("No transactions to import");
      return;
    }

    try {
      // Filter out skipped transactions
      const transactionsToImport = parseResult.transactions.filter(
        (_, index) => !skipIndices.includes(index)
      );

      if (transactionsToImport.length === 0) {
        toast({
          title: "No transactions to import",
          description: "All transactions were skipped.",
        });
        setStep("preview");
        return;
      }

      console.log("Importing transactions:", transactionsToImport.length);

      const result = await importTransactions.mutateAsync({
        transactions: transactionsToImport.map((tx) => ({
          ticker: tx.ticker,
          action: tx.action,
          datetime: tx.datetime,
          quantity: tx.quantity,
          price: tx.price,
          fees: tx.fees,
          assetClass: tx.assetClass as "stock" | "cryptocurrency" | "forex" | "futures" | "options" | "prediction_market",
          exchange: tx.exchange,
          notes: tx.notes,
        })),
        skipDuplicates: true,
      });

      console.log("Import result:", result);

      setImportedCount(result.imported);
      setStep("complete");

      toast({
        title: "Import successful",
        description: `${result.imported} transactions imported successfully.`,
      });
    } catch (error) {
      console.error("performImport error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setStep("upload");
    setFileContent("");
    setParseResult(null);
    setCSVHeaders([]);
    setSampleData([]);
    setSuggestedMapping(null);
    setDuplicates([]);
  };

  const handleNewImport = () => {
    setStep("upload");
    setFileContent("");
    setParseResult(null);
    setImportedCount(0);
    setCSVHeaders([]);
    setSampleData([]);
    setSuggestedMapping(null);
    setDuplicates([]);
  };

  const handleBackToPreview = () => {
    setStep("preview");
    setDuplicates([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Trades</h1>
        <p className="text-muted-foreground">
          Import trades from CSV files or connect to exchanges
        </p>
      </div>

      {step === "upload" && (
        <div className="space-y-6">
          {/* Provider Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Select Format (Optional)
              </CardTitle>
              <CardDescription>
                Auto-detection works for most brokers, but you can select manually if needed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedProvider || "auto"} onValueChange={(v) => setSelectedProvider(v === "auto" ? "" : v)}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Auto-detect format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  {providers?.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload File
              </CardTitle>
              <CardDescription>
                Upload a CSV or Excel file containing your trades
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                onFileSelect={handleFileSelect}
                disabled={parseCSV.isPending}
              />
              {parseCSV.isPending && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Parsing file...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Supported Formats */}
          <Card>
            <CardHeader>
              <CardTitle>Supported Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {providers?.map((provider) => (
                  <div
                    key={provider.id}
                    className="rounded-lg border p-4"
                  >
                    <h3 className="font-medium">{provider.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {provider.description}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Supports: {provider.supportedFileTypes.join(", ").toUpperCase()}
                    </p>
                  </div>
                ))}
                <div className="rounded-lg border border-dashed p-4">
                  <h3 className="font-medium">Generic CSV</h3>
                  <p className="text-sm text-muted-foreground">
                    Any CSV with standard columns (ticker, action, date, qty, price)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "mapping" && csvHeaders.length > 0 && (
        <ColumnMapping
          headers={csvHeaders}
          sampleData={sampleData}
          suggestedMapping={suggestedMapping}
          onApply={handleApplyMapping}
          onCancel={handleCancel}
          isApplying={parseCSV.isPending}
        />
      )}

      {step === "preview" && parseResult && (
        <ImportPreview
          transactions={parseResult.transactions}
          errors={parseResult.errors}
          warnings={parseResult.warnings}
          totalRows={parseResult.totalRows}
          successfulRows={parseResult.successfulRows}
          failedRows={parseResult.failedRows}
          provider={parseResult.provider}
          onImport={handleImport}
          onCancel={handleCancel}
          isImporting={checkDuplicates.isPending || importTransactions.isPending}
        />
      )}

      {step === "duplicates" && parseResult && (
        <DuplicateResolution
          transactions={parseResult.transactions}
          duplicates={duplicates}
          onProceed={handleDuplicateResolution}
          onCancel={handleBackToPreview}
          isProcessing={importTransactions.isPending}
        />
      )}

      {step === "complete" && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <div className="rounded-full bg-green-500/10 p-4">
              <Check className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="mt-6 text-2xl font-bold">Import Complete!</h2>
            <p className="mt-2 text-muted-foreground">
              {importedCount} transactions have been imported successfully.
            </p>
            <div className="mt-8 flex gap-4">
              <Button variant="outline" onClick={handleNewImport}>
                Import More
              </Button>
              <Button onClick={() => router.push("/trades")}>
                View Trades
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
