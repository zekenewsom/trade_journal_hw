import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Trades</h1>
        <p className="text-muted-foreground">
          Import trades from CSV, Excel, or connect to exchanges
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Trade import functionality will be available in Phase 2. This will include:
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-muted-foreground">
            <li>CSV/Excel file upload</li>
            <li>Broker-specific parsers (TradingView, ThinkOrSwim, IBKR)</li>
            <li>Duplicate detection and conflict resolution</li>
            <li>Background processing for large imports</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
