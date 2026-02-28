import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/reactbits/fade-in";
import { formatCurrency } from "@/lib/domain/calculations";
import { PortfolioSymbol } from "@/lib/domain/types";
import { upsertHolding } from "@/lib/db";
import { loadPortfolioSnapshot, PortfolioSnapshot, refreshPortfolioPrices } from "@/lib/portfolio";
import { RefreshCw, AlertTriangle, Coins } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

const ASSET_META: Record<PortfolioSymbol, { name: string }> = {
  BTC: { name: "Bitcoin" },
  ETH: { name: "Ethereum" },
  SOL: { name: "Solana" },
};

const PIE_COLORS = ["hsl(43 74% 66%)", "hsl(220 70% 50%)", "hsl(173 58% 39%)"];

function clampAmount(symbol: PortfolioSymbol, input: number): number {
  const maxDecimals = symbol === "BTC" ? 8 : 18;
  const factor = Math.pow(10, maxDecimals);
  return Math.floor(Math.max(input, 0) * factor) / factor;
}

export function PortfolioPage() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [inputs, setInputs] = useState<Record<PortfolioSymbol, string>>({
    BTC: "0",
    ETH: "0",
    SOL: "0",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "RON">("USD");

  const hydrateFromDb = useCallback(async () => {
    const data = await loadPortfolioSnapshot();
    setSnapshot(data);
    setInputs({
      BTC: String(data.assets.find((a) => a.symbol === "BTC")?.amount ?? 0),
      ETH: String(data.assets.find((a) => a.symbol === "ETH")?.amount ?? 0),
      SOL: String(data.assets.find((a) => a.symbol === "SOL")?.amount ?? 0),
    });
  }, []);

  const refreshAll = useCallback(
    async (network: boolean) => {
      if (network) setRefreshing(true);
      try {
        if (network) {
          const result = await refreshPortfolioPrices();
          setWarning(result.warning ?? null);
        }
        await hydrateFromDb();
      } finally {
        setLoading(false);
        if (network) setRefreshing(false);
      }
    },
    [hydrateFromDb]
  );

  useEffect(() => {
    refreshAll(true).catch((err) => {
      setWarning(String(err));
      setLoading(false);
      setRefreshing(false);
    });
  }, [refreshAll]);

  useEffect(() => {
    const id = window.setInterval(() => {
      refreshAll(true).catch(() => {
        // keep showing cached data
      });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refreshAll]);

  const saveAmount = useCallback(
    async (symbol: PortfolioSymbol) => {
      const parsed = Number(inputs[symbol]);
      if (!Number.isFinite(parsed) || parsed < 0) {
        if (snapshot) {
          const current = snapshot.assets.find((a) => a.symbol === symbol)?.amount ?? 0;
          setInputs((prev) => ({ ...prev, [symbol]: String(current) }));
        }
        return;
      }
      const amount = clampAmount(symbol, parsed);
      await upsertHolding(symbol, amount);
      await hydrateFromDb();
      setInputs((prev) => ({ ...prev, [symbol]: String(amount) }));
    },
    [hydrateFromDb, inputs, snapshot]
  );

  const allocationData = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.assets
      .map((asset) => ({ name: asset.symbol, value: asset.valueUSD }))
      .filter((x) => x.value > 0);
  }, [snapshot]);

  if (loading || !snapshot) {
    return <div className="text-center text-muted-foreground py-10">Loading portfolio...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Crypto Portfolio</h2>
          <p className="text-sm text-muted-foreground">
            Total Value:{" "}
            <span className="font-medium text-foreground">
              {displayCurrency === "USD"
                ? formatCurrency(snapshot.totalUSD, "USD")
                : formatCurrency(snapshot.totalRON, "RON")}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Last updated: {snapshot.lastUpdated ? new Date(snapshot.lastUpdated).toLocaleString() : "No data"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              variant={displayCurrency === "USD" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDisplayCurrency("USD")}
            >
              USD
            </Button>
            <Button
              variant={displayCurrency === "RON" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDisplayCurrency("RON")}
            >
              RON
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refreshAll(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {(warning || snapshot.stale) && (
        <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <div className="text-warning-foreground">
            <div>{warning || "Showing cached data. Latest prices may be stale."}</div>
            <div className="text-xs opacity-90">
              Auto-refresh runs every 60s while this page is open. For critical decisions, verify prices and balances in your wallet/exchange.
            </div>
          </div>
          <Badge variant="secondary" className="ml-auto">Stale</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {snapshot.assets.map((asset, index) => (
          <FadeIn key={asset.symbol} delay={index * 40}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{asset.symbol}</span>
                  <span className="text-xs text-muted-foreground">{ASSET_META[asset.symbol].name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Holdings</div>
                  <Input
                    value={inputs[asset.symbol]}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                    onBlur={() => saveAmount(asset.symbol)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveAmount(asset.symbol);
                      }
                    }}
                    inputMode="decimal"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Price: {formatCurrency(asset.priceUSD, "USD")} / {formatCurrency(asset.priceEUR, "EUR")}
                </div>
                <div className="text-sm">
                  Value:{" "}
                  <span className="font-medium">
                    {displayCurrency === "USD"
                      ? formatCurrency(asset.valueUSD, "USD")
                      : formatCurrency(asset.valueRON, "RON")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {displayCurrency === "USD"
                    ? `RON: ${formatCurrency(asset.valueRON, "RON")}`
                    : `USD: ${formatCurrency(asset.valueUSD, "USD")}`}
                </div>
                <div className="text-xs">
                  24h:{" "}
                  <span className={asset.change24h !== null && asset.change24h < 0 ? "text-expense" : "text-income"}>
                    {asset.change24h !== null ? `${asset.change24h.toFixed(2)}%` : "N/A"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        ))}

        <FadeIn delay={120}>
          <Card className="xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allocationData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No holdings yet.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={allocationData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={45}>
                        {allocationData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => formatCurrency(Number(value), "USD")} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
