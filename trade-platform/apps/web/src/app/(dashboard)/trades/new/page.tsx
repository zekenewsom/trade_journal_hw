"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/trpc/react";
import { useToast } from "@/components/ui/use-toast";

const transactionSchema = z.object({
  action: z.enum(["buy", "sell"]),
  quantity: z.string().min(1, "Quantity is required"),
  price: z.string().min(1, "Price is required"),
  datetime: z.string().min(1, "Date/time is required"),
  fees: z.string().optional(),
  notes: z.string().optional(),
});

const formSchema = z.object({
  instrumentTicker: z.string().min(1, "Ticker is required").max(20),
  assetClass: z.enum(["crypto", "stocks", "options", "futures", "forex"]),
  exchange: z.string().min(1, "Exchange is required").max(50),
  transactions: z.array(transactionSchema).min(1, "At least one transaction is required"),
  strategyId: z.string().optional(),
  setupDescription: z.string().optional(),
  reasoning: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const defaultTransaction = {
  action: "buy" as const,
  quantity: "",
  price: "",
  datetime: new Date().toISOString().slice(0, 16),
  fees: "",
  notes: "",
};

export default function NewTradePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: strategies } = api.strategies.list.useQuery();
  const createTrade = api.trades.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Trade created",
        description: "Your trade has been logged successfully.",
      });
      router.push(`/trades/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create trade",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      instrumentTicker: "",
      assetClass: "crypto",
      exchange: "",
      transactions: [defaultTransaction],
      strategyId: "",
      setupDescription: "",
      reasoning: "",
    },
  });

  const transactions = form.watch("transactions");

  const addTransaction = () => {
    const current = form.getValues("transactions");
    form.setValue("transactions", [...current, defaultTransaction]);
  };

  const removeTransaction = (index: number) => {
    const current = form.getValues("transactions");
    if (current.length > 1) {
      form.setValue(
        "transactions",
        current.filter((_, i) => i !== index)
      );
    }
  };

  const onSubmit = (values: FormValues) => {
    setIsSubmitting(true);
    createTrade.mutate({
      instrumentTicker: values.instrumentTicker.toUpperCase(),
      assetClass: values.assetClass,
      exchange: values.exchange,
      strategyId: values.strategyId || undefined,
      setupDescription: values.setupDescription || undefined,
      reasoning: values.reasoning || undefined,
      transactions: values.transactions.map((tx) => ({
        action: tx.action,
        quantity: parseFloat(tx.quantity),
        price: parseFloat(tx.price),
        datetime: new Date(tx.datetime).toISOString(),
        fees: tx.fees ? parseFloat(tx.fees) : 0,
        notes: tx.notes || undefined,
      })),
    });
  };

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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trade Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="instrumentTicker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticker Symbol</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="BTC, AAPL, ES..."
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assetClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Class</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="crypto">Crypto</SelectItem>
                          <SelectItem value="stocks">Stocks</SelectItem>
                          <SelectItem value="options">Options</SelectItem>
                          <SelectItem value="futures">Futures</SelectItem>
                          <SelectItem value="forex">Forex</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="exchange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exchange</FormLabel>
                      <FormControl>
                        <Input placeholder="Binance, NYSE, CME..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="strategyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strategy (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a strategy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No strategy</SelectItem>
                        {strategies?.map((strategy) => (
                          <SelectItem key={strategy.id} value={strategy.id}>
                            {strategy.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Transactions</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addTransaction}>
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {transactions.map((_, index) => (
                <div
                  key={index}
                  className="rounded-lg border p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Transaction {index + 1}
                    </span>
                    {transactions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTransaction(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      control={form.control}
                      name={`transactions.${index}.action`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Action</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="buy">Buy</SelectItem>
                              <SelectItem value="sell">Sell</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`transactions.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`transactions.${index}.price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`transactions.${index}.datetime`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date & Time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`transactions.${index}.fees`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fees (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`transactions.${index}.notes`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Transaction notes..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trade Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="setupDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setup Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your trade setup..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      What pattern or setup did you identify?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reasoning"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reasoning</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Why did you take this trade?"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      What was your thesis for entering this position?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/trades">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Trade"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
