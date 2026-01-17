"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewTradePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/trades">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Trade</h1>
          <p className="text-muted-foreground">
            Log a new trade with transactions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade Entry Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Manual trade entry form will be available soon. For now, you can:
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-muted-foreground">
            <li>Import trades via CSV/Excel (Phase 2)</li>
            <li>Connect exchange integrations (Phase 2-4)</li>
          </ul>
          <div className="mt-6">
            <Link href="/trades">
              <Button variant="outline">Back to Trades</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
