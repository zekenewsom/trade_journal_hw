import { Wallet, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const integrations = [
  {
    name: "Hyperliquid",
    description: "DEX - Perpetuals trading",
    status: "coming_soon",
    phase: "Phase 2",
  },
  {
    name: "Polymarket",
    description: "Prediction markets",
    status: "coming_soon",
    phase: "Phase 2",
  },
  {
    name: "Kalshi",
    description: "Event contracts",
    status: "coming_soon",
    phase: "Phase 2",
  },
  {
    name: "Binance",
    description: "Cryptocurrency exchange",
    status: "coming_soon",
    phase: "Phase 3",
  },
  {
    name: "Coinbase",
    description: "Cryptocurrency exchange",
    status: "coming_soon",
    phase: "Phase 3",
  },
  {
    name: "E*Trade",
    description: "Traditional brokerage",
    status: "coming_soon",
    phase: "Phase 4",
  },
  {
    name: "Schwab",
    description: "Traditional brokerage",
    status: "coming_soon",
    phase: "Phase 4",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your trading accounts for automatic sync
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{integration.name}</CardTitle>
                <span className="rounded-full bg-muted px-2 py-1 text-xs">
                  {integration.phase}
                </span>
              </div>
              <CardDescription>{integration.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                <Wallet className="mr-2 h-4 w-4" />
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
