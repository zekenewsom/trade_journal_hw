"use client";

import { useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

interface JobProgressProps {
  jobId: string;
  onComplete: (result: { imported: number; errors: number }) => void;
  onCancel: () => void;
}

export function JobProgress({ jobId, onComplete, onCancel }: JobProgressProps) {
  const { data: job } = api.imports.getJobStatus.useQuery(
    { jobId },
    {
      refetchInterval: (query) => {
        // Stop polling when job is done
        const data = query.state.data;
        if (data?.status === "completed" || data?.status === "failed") {
          return false;
        }
        return 2000; // Poll every 2 seconds
      },
    }
  );

  useEffect(() => {
    if (job?.status === "completed") {
      onComplete({
        imported: job.importedTransactions || 0,
        errors: job.errors?.length || 0,
      });
    }
  }, [job?.status, job?.importedTransactions, job?.errors, onComplete]);

  if (!job) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const progress = job.totalTransactions
    ? Math.round(((job.processedTransactions || 0) / job.totalTransactions) * 100)
    : 0;

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-yellow-500",
      title: "Preparing Import",
      description: "Your import is queued and will begin shortly.",
    },
    processing: {
      icon: Loader2,
      color: "text-blue-500",
      title: "Importing Transactions",
      description: `Processing ${job.processedTransactions || 0} of ${job.totalTransactions} transactions...`,
    },
    completed: {
      icon: CheckCircle2,
      color: "text-green-500",
      title: "Import Complete",
      description: `Successfully imported ${job.importedTransactions} transactions.`,
    },
    failed: {
      icon: XCircle,
      color: "text-red-500",
      title: "Import Failed",
      description: job.errorMessage || "An error occurred during import.",
    },
  };

  const status = statusConfig[job.status as keyof typeof statusConfig];
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <StatusIcon
            className={`h-6 w-6 ${status.color} ${job.status === "processing" ? "animate-spin" : ""}`}
          />
          <div>
            <CardTitle>{status.title}</CardTitle>
            <CardDescription>{status.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {(job.status === "pending" || job.status === "processing") && (
          <>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {job.processedTransactions || 0} / {job.totalTransactions} transactions
              </span>
              <span>{progress}%</span>
            </div>
          </>
        )}

        {job.status === "completed" && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-500">{job.importedTransactions}</p>
              <p className="text-xs text-muted-foreground">Imported</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{job.skippedTransactions}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{job.errors?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>
        )}

        {job.status === "failed" && job.errors && job.errors.length > 0 && (
          <div className="max-h-40 overflow-auto rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Errors:</p>
            <ul className="space-y-1 text-sm text-destructive">
              {job.errors.slice(0, 5).map((error, i) => (
                <li key={i}>
                  {error.index !== undefined && `Row ${error.index}: `}
                  {error.ticker && `${error.ticker}: `}
                  {error.error}
                </li>
              ))}
              {job.errors.length > 5 && (
                <li className="text-muted-foreground">
                  ...and {job.errors.length - 5} more errors
                </li>
              )}
            </ul>
          </div>
        )}

        {(job.status === "pending" || job.status === "processing") && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
