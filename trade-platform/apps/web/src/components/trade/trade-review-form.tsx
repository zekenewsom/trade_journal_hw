"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StarRating } from "./star-rating";
import { api } from "@/trpc/react";
import { useToast } from "@/components/ui/use-toast";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface TradeReviewFormProps {
  tradeId: string;
  initialData: {
    thesisValidation?: string | null;
    planAdherence?: string | null;
    planAdherenceNotes?: string | null;
    unforeseenEvents?: string | null;
    overallRating?: number | null;
    outcomeOverride?: string | null;
    keyLesson1?: string | null;
    keyLesson2?: string | null;
    keyLesson3?: string | null;
    decisionPrice?: string | null;
    systemOutcome?: string | null;
  };
}

export function TradeReviewForm({ tradeId, initialData }: TradeReviewFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);

  // Form state
  const [thesisValidation, setThesisValidation] = useState<string | undefined>(
    initialData.thesisValidation ?? undefined
  );
  const [planAdherence, setPlanAdherence] = useState<string | undefined>(
    initialData.planAdherence ?? undefined
  );
  const [planAdherenceNotes, setPlanAdherenceNotes] = useState(
    initialData.planAdherenceNotes ?? ""
  );
  const [unforeseenEvents, setUnforeseenEvents] = useState(
    initialData.unforeseenEvents ?? ""
  );
  const [overallRating, setOverallRating] = useState<number | null>(
    initialData.overallRating ?? null
  );
  const [enableOutcomeOverride, setEnableOutcomeOverride] = useState(
    !!initialData.outcomeOverride
  );
  const [outcomeOverride, setOutcomeOverride] = useState<string | undefined>(
    initialData.outcomeOverride ?? undefined
  );
  const [keyLesson1, setKeyLesson1] = useState(initialData.keyLesson1 ?? "");
  const [keyLesson2, setKeyLesson2] = useState(initialData.keyLesson2 ?? "");
  const [keyLesson3, setKeyLesson3] = useState(initialData.keyLesson3 ?? "");
  const [decisionPrice, setDecisionPrice] = useState(
    initialData.decisionPrice ?? ""
  );

  const updateMetadata = api.trades.updateMetadata.useMutation({
    onSuccess: () => {
      toast({
        title: "Review saved",
        description: "Your trade review has been saved successfully.",
      });
      startTransition(() => {
        router.refresh();
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save trade review.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateMetadata.mutate({
      tradeId,
      thesisValidation: thesisValidation as "correct" | "partial" | "incorrect" | undefined,
      planAdherence: planAdherence as "high" | "medium" | "low" | undefined,
      planAdherenceNotes: planAdherenceNotes || null,
      unforeseenEvents: unforeseenEvents || null,
      overallRating: overallRating ?? undefined,
      outcomeOverride: enableOutcomeOverride
        ? (outcomeOverride as "win" | "loss" | "break_even" | undefined)
        : null,
      keyLesson1: keyLesson1 || null,
      keyLesson2: keyLesson2 || null,
      keyLesson3: keyLesson3 || null,
      decisionPrice: decisionPrice || null,
    });
  };

  const isLoading = updateMetadata.isPending || isPending;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center gap-2">
          Trade Review
          {overallRating && (
            <span className="text-sm font-normal text-muted-foreground">
              ({overallRating}/5)
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="icon">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Overall Rating */}
            <div className="space-y-2">
              <Label>Overall Rating</Label>
              <StarRating
                value={overallRating}
                onChange={setOverallRating}
                size="lg"
              />
            </div>

            {/* Thesis Validation */}
            <div className="space-y-2">
              <Label>Was Your Thesis Correct?</Label>
              <Select
                value={thesisValidation}
                onValueChange={setThesisValidation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="correct">Correct - Thesis played out as expected</SelectItem>
                  <SelectItem value="partial">Partial - Thesis was partially correct</SelectItem>
                  <SelectItem value="incorrect">Incorrect - Thesis was wrong</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Plan Adherence */}
            <div className="space-y-3">
              <Label>Did You Follow Your Trading Plan?</Label>
              <RadioGroup
                value={planAdherence}
                onValueChange={setPlanAdherence}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="high" id="adherence-high" />
                  <Label htmlFor="adherence-high" className="cursor-pointer">
                    High
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="adherence-medium" />
                  <Label htmlFor="adherence-medium" className="cursor-pointer">
                    Medium
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="low" id="adherence-low" />
                  <Label htmlFor="adherence-low" className="cursor-pointer">
                    Low
                  </Label>
                </div>
              </RadioGroup>
              <Textarea
                placeholder="Notes on plan adherence (e.g., deviations, reasons)..."
                value={planAdherenceNotes}
                onChange={(e) => setPlanAdherenceNotes(e.target.value)}
                maxLength={2000}
              />
            </div>

            {/* Outcome Override */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="outcome-override"
                  checked={enableOutcomeOverride}
                  onCheckedChange={(checked) => {
                    setEnableOutcomeOverride(!!checked);
                    if (!checked) setOutcomeOverride(undefined);
                  }}
                />
                <Label htmlFor="outcome-override" className="cursor-pointer">
                  Override System Outcome
                  {initialData.systemOutcome && (
                    <span className="ml-2 text-muted-foreground">
                      (System: {initialData.systemOutcome})
                    </span>
                  )}
                </Label>
              </div>
              {enableOutcomeOverride && (
                <Select
                  value={outcomeOverride}
                  onValueChange={setOutcomeOverride}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="win">Win</SelectItem>
                    <SelectItem value="loss">Loss</SelectItem>
                    <SelectItem value="break_even">Break Even</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Key Lessons */}
            <div className="space-y-3">
              <Label>Key Lessons (max 500 characters each)</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Lesson 1..."
                  value={keyLesson1}
                  onChange={(e) => setKeyLesson1(e.target.value)}
                  maxLength={500}
                />
                <Input
                  placeholder="Lesson 2..."
                  value={keyLesson2}
                  onChange={(e) => setKeyLesson2(e.target.value)}
                  maxLength={500}
                />
                <Input
                  placeholder="Lesson 3..."
                  value={keyLesson3}
                  onChange={(e) => setKeyLesson3(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>

            {/* Unforeseen Events */}
            <div className="space-y-2">
              <Label>Unforeseen Events</Label>
              <Textarea
                placeholder="Describe any unexpected events that affected this trade..."
                value={unforeseenEvents}
                onChange={(e) => setUnforeseenEvents(e.target.value)}
                maxLength={5000}
                rows={3}
              />
            </div>

            {/* Decision Price (for Implementation Shortfall) */}
            <div className="space-y-2">
              <Label>Decision Price</Label>
              <p className="text-xs text-muted-foreground">
                Enter the price at which you decided to trade (for slippage calculation)
              </p>
              <Input
                type="number"
                step="any"
                placeholder="e.g., 150.25"
                value={decisionPrice}
                onChange={(e) => setDecisionPrice(e.target.value)}
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Review"
              )}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
