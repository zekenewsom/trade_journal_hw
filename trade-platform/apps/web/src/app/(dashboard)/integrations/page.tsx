"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ExternalLink, Check, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/trpc/react";
import { toast } from "@/components/ui/use-toast";
import { formatRelativeTime } from "@/lib/format";

type DexPlatform = "hyperliquid" | "polymarket" | "kalshi";

export default function IntegrationsPage() {
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<DexPlatform | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [previewTrades, setPreviewTrades] = useState<{ ticker: string; action: string; datetime: string; quantity: string; price: string }[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const { data: platforms } = api.integrations.getDexPlatforms.useQuery();
  const { data: connections, refetch: refetchConnections } = api.integrations.getConnections.useQuery();
  const fetchTrades = api.integrations.fetchDexTrades.useMutation();
  const importTrades = api.integrations.importDexTrades.useMutation();
  const saveConnection = api.integrations.saveConnection.useMutation();
  const disconnect = api.integrations.disconnect.useMutation();
  const syncConnection = api.integrations.syncConnection.useMutation();

  const handleConnect = async () => {
    if (!selectedPlatform || !walletAddress) return;

    setIsConnecting(true);

    try {
      const result = await fetchTrades.mutateAsync({
        platform: selectedPlatform,
        walletAddress,
        apiKey: selectedPlatform === "kalshi" ? apiKey : undefined,
        limit: 50,
      });

      setPreviewTrades(result.trades);
      setShowPreview(true);

      toast({
        title: "Connected successfully",
        description: `Found ${result.totalTrades} trades on ${selectedPlatform}`,
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedPlatform || !walletAddress) return;

    try {
      // Save the connection first
      await saveConnection.mutateAsync({
        platform: selectedPlatform,
        walletAddress,
      });

      const result = await importTrades.mutateAsync({
        platform: selectedPlatform,
        walletAddress,
        apiKey: selectedPlatform === "kalshi" ? apiKey : undefined,
      });

      toast({
        title: "Import successful",
        description: `${result.imported} trades imported from ${selectedPlatform}`,
      });

      setShowPreview(false);
      setSelectedPlatform(null);
      setWalletAddress("");
      setApiKey("");
      setPreviewTrades([]);

      refetchConnections();
      router.push("/trades");
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncingId(connectionId);
    try {
      const result = await syncConnection.mutateAsync({ connectionId });

      toast({
        title: "Sync complete",
        description: result.imported > 0
          ? `Imported ${result.imported} new transactions`
          : "No new trades found",
      });

      refetchConnections();
    } catch (error) {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      refetchConnections();
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!connections || connections.length === 0) return;

    setIsSyncingAll(true);
    let totalImported = 0;
    let failedCount = 0;

    for (const connection of connections) {
      try {
        const result = await syncConnection.mutateAsync({ connectionId: connection.id });
        totalImported += result.imported;
      } catch {
        failedCount++;
      }
    }

    toast({
      title: "Sync all complete",
      description: failedCount > 0
        ? `Imported ${totalImported} transactions. ${failedCount} connection(s) failed.`
        : totalImported > 0
          ? `Imported ${totalImported} new transactions`
          : "No new trades found",
      variant: failedCount > 0 ? "destructive" : "default",
    });

    refetchConnections();
    setIsSyncingAll(false);
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      const result = await disconnect.mutateAsync({
        connectionId,
        removeTrades: true,
      });

      toast({
        title: "Disconnected successfully",
        description: result.tradesRemoved > 0
          ? `Removed ${result.tradesRemoved} trades from ${result.connectionName}`
          : `Disconnected from ${result.connectionName}`,
      });

      refetchConnections();
    } catch (error) {
      toast({
        title: "Disconnect failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  const closeDialog = () => {
    setSelectedPlatform(null);
    setWalletAddress("");
    setApiKey("");
    setPreviewTrades([]);
    setShowPreview(false);
  };

  // Get connected wallet addresses per platform (allows multiple per platform)
  const connectedWallets = connections?.reduce((acc, c) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c.walletAddress);
    return acc;
  }, {} as Record<string, string[]>) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect to exchanges and import your trade history
          </p>
        </div>
        {connections && connections.length > 0 && (
          <Button
            onClick={handleSyncAll}
            disabled={isSyncingAll || syncingId !== null}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncingAll ? "animate-spin" : ""}`} />
            {isSyncingAll ? "Syncing..." : "Sync All"}
          </Button>
        )}
      </div>

      {/* Connected Integrations */}
      {connections && connections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Connected</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connections.map((connection) => (
              <Card key={connection.id} className="border-green-500/30 bg-green-500/5">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-500" />
                        {connection.name}
                      </CardTitle>
                      <CardDescription className="mt-1 font-mono text-xs">
                        {connection.walletAddress.slice(0, 10)}...{connection.walletAddress.slice(-8)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Connected
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {connection.lastSyncAt ? (
                        <span>Last synced: {formatRelativeTime(connection.lastSyncAt)}</span>
                      ) : (
                        <span className="text-yellow-500">Never synced</span>
                      )}
                      {connection.syncStatus === "error" && connection.syncErrorMessage && (
                        <p className="text-red-500 mt-1">Error: {connection.syncErrorMessage}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleSync(connection.id)}
                        disabled={syncingId !== null || isSyncingAll}
                        title="Sync now"
                      >
                        <RefreshCw className={`h-4 w-4 ${syncingId === connection.id || isSyncingAll ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => setDisconnectingId(connection.id)}
                        title="Disconnect"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* DEX Integrations */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">DEX & Prediction Markets</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {platforms?.map((platform) => {
            const connectedCount = connectedWallets[platform.id]?.length || 0;
            return (
              <Card key={platform.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        {platform.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {platform.description}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {connectedCount > 0 && (
                        <Badge variant="secondary" className="text-green-600">
                          {connectedCount} connected
                        </Badge>
                      )}
                      {platform.requiresApiKey && (
                        <Badge variant="outline">API Key</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <a
                      href={platform.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Visit site
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button
                      size="sm"
                      onClick={() => setSelectedPlatform(platform.id as DexPlatform)}
                    >
                      {connectedCount > 0 ? "Add Another" : "Connect"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Coming Soon */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">CEX Integrations (Coming Soon)</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Binance", description: "Crypto exchange" },
            { name: "Coinbase", description: "Crypto exchange" },
            { name: "E*Trade", description: "Stock brokerage" },
            { name: "Schwab", description: "Stock brokerage" },
          ].map((exchange) => (
            <Card key={exchange.name} className="opacity-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  {exchange.name}
                </CardTitle>
                <CardDescription>{exchange.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">Phase 3-4</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Connection Dialog */}
      <Dialog open={!!selectedPlatform && !showPreview} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect to {platforms?.find((p) => p.id === selectedPlatform)?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your wallet address to fetch your trade history
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wallet">
                {selectedPlatform === "kalshi" ? "Email or Member ID" : "Wallet Address"}
              </Label>
              <Input
                id="wallet"
                placeholder={
                  selectedPlatform === "kalshi"
                    ? "your@email.com"
                    : "0x..."
                }
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
              />
              {selectedPlatform && walletAddress && connectedWallets[selectedPlatform]?.includes(walletAddress) && (
                <p className="text-sm text-yellow-500">
                  This wallet is already connected. Connecting again will sync new trades.
                </p>
              )}
            </div>

            {selectedPlatform === "kalshi" && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Your Kalshi API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://kalshi.com/account/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Kalshi API Settings
                  </a>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={!walletAddress || isConnecting || (selectedPlatform === "kalshi" && !apiKey)}
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect & Preview"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Trade Preview - {platforms?.find((p) => p.id === selectedPlatform)?.name}
            </DialogTitle>
            <DialogDescription>
              Found {previewTrades.length} trades. Review before importing.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="p-2 text-left">Ticker</th>
                  <th className="p-2 text-left">Action</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {previewTrades.slice(0, 50).map((trade, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 font-mono">{trade.ticker}</td>
                    <td className="p-2">
                      <Badge
                        variant={trade.action === "buy" ? "default" : "secondary"}
                      >
                        {trade.action.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {new Date(trade.datetime).toLocaleDateString()}
                    </td>
                    <td className="p-2 text-right font-mono">{trade.quantity}</td>
                    <td className="p-2 text-right font-mono">${trade.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewTrades.length > 50 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Showing first 50 of {previewTrades.length} trades
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importTrades.isPending || saveConnection.isPending}
              className="gap-2"
            >
              {importTrades.isPending || saveConnection.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Import {previewTrades.length} Trades
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={!!disconnectingId} onOpenChange={(open) => !open && setDisconnectingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Disconnect Wallet
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to disconnect this wallet? This action will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-red-500 font-medium">
                <li>Remove all trades imported from this wallet</li>
                <li>Delete all associated transactions</li>
                <li>Remove the connection from your account</li>
              </ul>
              <p className="font-semibold">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectingId && handleDisconnect(disconnectingId)}
              className="bg-red-500 hover:bg-red-600"
            >
              {disconnect.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect & Remove Trades"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
