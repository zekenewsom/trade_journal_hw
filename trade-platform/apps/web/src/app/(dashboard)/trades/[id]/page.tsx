import { notFound } from "next/navigation";
import { api } from "@/lib/trpc/server";
import { TradeDetail } from "@/components/trades/trade-detail";

interface TradePageProps {
  params: Promise<{ id: string }>;
}

export default async function TradePage({ params }: TradePageProps) {
  const { id } = await params;
  const tradeId = parseInt(id, 10);

  if (isNaN(tradeId)) {
    notFound();
  }

  const caller = await api();
  const trade = await caller.trades.getById({ id: tradeId });

  if (!trade) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <TradeDetail trade={trade} />
    </div>
  );
}
