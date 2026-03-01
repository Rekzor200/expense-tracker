import { invoke } from "@tauri-apps/api/core";
import {
  getFxCache,
  getHoldings,
  getPriceCache,
  upsertFxCache,
  upsertPriceCache,
} from "@/lib/db";
import { FxCache, Holding, PortfolioSymbol, PriceCache } from "@/lib/domain/types";
import { roundToCents } from "@/lib/domain/calculations";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,eur&include_24hr_change=true";
const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

const ID_TO_SYMBOL: Record<string, PortfolioSymbol> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
};

type CoinGeckoEntry = {
  usd?: number;
  eur?: number;
  usd_24h_change?: number;
};

type CoinGeckoResponse = Record<string, CoinGeckoEntry>;

async function httpGetText(url: string): Promise<string> {
  return invoke<string>("http_get_text", { url });
}

export interface PortfolioAssetView {
  symbol: PortfolioSymbol;
  amount: number;
  priceUSD: number;
  priceEUR: number;
  change24h: number | null;
  valueUSD: number;
  valueRON: number;
}

export interface PortfolioSnapshot {
  assets: PortfolioAssetView[];
  totalUSD: number;
  totalRON: number;
  lastUpdated: string | null;
  stale: boolean;
  eurRon: number | null;
}

export async function fetchCryptoPrices(): Promise<
  Record<PortfolioSymbol, { usd: number; eur: number; change24h: number | null }>
> {
  const raw = await httpGetText(COINGECKO_URL);
  const data = JSON.parse(raw) as CoinGeckoResponse;
  const result: Record<PortfolioSymbol, { usd: number; eur: number; change24h: number | null }> = {
    BTC: { usd: 0, eur: 0, change24h: null },
    ETH: { usd: 0, eur: 0, change24h: null },
    SOL: { usd: 0, eur: 0, change24h: null },
  };

  for (const [id, symbol] of Object.entries(ID_TO_SYMBOL)) {
    const row = data[id];
    if (!row || typeof row.usd !== "number" || typeof row.eur !== "number") {
      throw new Error(`Missing price data for ${symbol}`);
    }
    result[symbol] = {
      usd: row.usd,
      eur: row.eur,
      change24h: typeof row.usd_24h_change === "number" ? row.usd_24h_change : null,
    };
  }

  return result;
}

export async function fetchEurRonRate(): Promise<{ rate: number; rateDate: string }> {
  const xml = await httpGetText(ECB_URL);
  const dateMatch = xml.match(/<Cube time=['"](\d{4}-\d{2}-\d{2})['"]/);
  const rateMatch = xml.match(/<Cube currency=['"]RON['"] rate=['"]([0-9.]+)['"]/);
  if (!dateMatch || !rateMatch) {
    throw new Error("Failed to parse ECB EUR/RON rate");
  }
  const rate = Number(rateMatch[1]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid EUR/RON rate");
  }
  return { rate, rateDate: dateMatch[1] };
}

function buildSnapshot(
  holdings: Holding[],
  priceRows: PriceCache[],
  fx: FxCache | null
): PortfolioSnapshot {
  const priceMap = new Map<string, PriceCache>();
  for (const row of priceRows) {
    priceMap.set(`${row.symbol}:${row.currency}`, row);
  }

  const eurRon = fx?.rate ?? null;
  let totalUSD = 0;
  let totalRON = 0;
  const assets: PortfolioAssetView[] = holdings.map((h) => {
    const usd = priceMap.get(`${h.symbol}:USD`)?.price ?? 0;
    const eur = priceMap.get(`${h.symbol}:EUR`)?.price ?? 0;
    const change24h = priceMap.get(`${h.symbol}:USD`)?.change24h ?? null;
    const valueUSD = roundToCents(h.amount * usd);
    const valueRON = roundToCents(eurRon ? h.amount * eur * eurRon : 0);
    totalUSD = roundToCents(totalUSD + valueUSD);
    totalRON = roundToCents(totalRON + valueRON);
    return {
      symbol: h.symbol,
      amount: h.amount,
      priceUSD: roundToCents(usd),
      priceEUR: roundToCents(eur),
      change24h,
      valueUSD,
      valueRON,
    };
  });

  const timestamps: number[] = [];
  for (const row of priceRows) {
    const t = Date.parse(row.updatedAt);
    if (!Number.isNaN(t)) timestamps.push(t);
  }
  if (fx) {
    const t = Date.parse(fx.updatedAt);
    if (!Number.isNaN(t)) timestamps.push(t);
  }
  const latest = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
  const stale = latest ? Date.now() - Date.parse(latest) > 6 * 60 * 60 * 1000 : true;

  return {
    assets,
    totalUSD: roundToCents(totalUSD),
    totalRON: roundToCents(totalRON),
    lastUpdated: latest,
    stale,
    eurRon: eurRon !== null ? roundToCents(eurRon) : null,
  };
}

export async function loadPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const [holdings, priceRows, fx] = await Promise.all([getHoldings(), getPriceCache(), getFxCache()]);
  return buildSnapshot(holdings, priceRows, fx);
}

export async function refreshPortfolioPrices(): Promise<{ warning?: string }> {
  const warnings: string[] = [];

  try {
    const prices = await fetchCryptoPrices();
    const rows: Omit<PriceCache, "updatedAt">[] = [];
    for (const [symbol, quote] of Object.entries(prices) as Array<
      [PortfolioSymbol, { usd: number; eur: number; change24h: number | null }]
    >) {
      rows.push({
        symbol,
        currency: "USD",
        price: quote.usd,
        change24h: quote.change24h,
        source: "coingecko",
      });
      rows.push({
        symbol,
        currency: "EUR",
        price: quote.eur,
        change24h: quote.change24h,
        source: "coingecko",
      });
    }
    await upsertPriceCache(rows);
  } catch {
    warnings.push("Using cached crypto prices.");
  }

  try {
    const fx = await fetchEurRonRate();
    await upsertFxCache({
      base: "EUR",
      quote: "RON",
      rate: fx.rate,
      rateDate: fx.rateDate,
      source: "ecb",
    });
  } catch {
    warnings.push("Using cached EUR/RON rate.");
  }

  return warnings.length > 0 ? { warning: warnings.join(" ") } : {};
}
